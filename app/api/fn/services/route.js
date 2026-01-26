import { NextResponse } from 'next/server';
import { FnOsClient, fetchNasList } from '../../../lib/fn-client';

// Force Node.js runtime which is more stable for SCF/EdgeOne than 'edge'
export const runtime = 'nodejs';

// 全局鉴权密钥，用于 API 调用校验
// 请修改此处的密钥或设置环境变量 GLOBAL_AUTH_KEY
const GLOBAL_AUTH_KEY = process.env.GLOBAL_AUTH_KEY || 'sk_random_key_123456';

export async function POST(request) {
    try {
        let body = {};
        try {
            // Debug: Log all headers
            const headers = {};
            request.headers.forEach((value, key) => headers[key] = value);
            console.log('[API Debug] Headers:', JSON.stringify(headers));

            // Strategy 1: Standard JSON parse
            try {
                 const cloned = request.clone();
                 body = await cloned.json();
                 console.log('[API Debug] Strategy 1 (json) success');
            } catch (e1) {
                console.log('[API Debug] Strategy 1 (json) failed:', e1.message);
                
                // Strategy 2: ArrayBuffer
                try {
                    const arrayBuffer = await request.arrayBuffer();
                    const bodyText = new TextDecoder().decode(arrayBuffer);
                    if (bodyText) {
                         body = JSON.parse(bodyText);
                         console.log('[API Debug] Strategy 2 (ArrayBuffer) success, length:', bodyText.length);
                    }
                } catch (e2) {
                     console.log('[API Debug] Strategy 2 (ArrayBuffer) failed:', e2.message);
                }
            }

            // Strategy 3: Check if body is already parsed (unlikely in App Router but possible in some adapters)
            if (!body || Object.keys(body).length === 0) {
                 if (request.body && typeof request.body === 'object' && !request.body.getReader) {
                      body = request.body;
                      console.log('[API Debug] Strategy 3 (request.body) success');
                 }
            }

            // Strategy 4: Handle GET request with query params as fallback
            if ((!body || Object.keys(body).length === 0) && request.method === 'POST') {
                const url = new URL(request.url);
                const queryParams = Object.fromEntries(url.searchParams);
                if (queryParams.fnId && queryParams.username) {
                    console.log('[API Debug] Strategy 4 (Query Params Fallback) success');
                    body = queryParams;
                }
            }
            
            // Final check
            if (!body || Object.keys(body).length === 0) {
                throw new Error('All parsing strategies failed or body is empty');
            }
            
            // Debug logs
            console.log('[API Debug] Request Method:', request.method);
            console.log('[API Debug] Body keys:', Object.keys(body));
            
        } catch (e) {
            console.error('Body Read/Parse Error:', e);
            
            return NextResponse.json({ 
                success: false, 
                error: 'Empty or Invalid request body',
                debug: {
                    method: request.method,
                    url: request.url,
                    headers: Object.fromEntries(request.headers),
                    error: e.message
                }
            }, { status: 400 });
        }

        const { username, password, fnId, key, isLocal } = body;

        // 全局密钥鉴权
        if (key !== GLOBAL_AUTH_KEY) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Invalid key' }, { status: 401 });
        }
        
        if (!username || !password || !fnId) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const config = { fnId, username, password };

        console.log('Fetching services list...');
        
        // 1. Get NAS Host
        const nasData = await fetchNasList(config);
        const nasHost = nasData.fn && nasData.fn[0] ? nasData.fn[0].split(':')[0] : null;

        if (!nasHost) {
            throw new Error('Failed to parse NAS host from list');
        }
        
        // 2. Connect via WebSocket
        const client = new FnOsClient(nasHost, {
            headers: {
                 'Cookie': 'mode=relay; language=zh;entry-token=9f531e22575646b5ab5ffa3254e14006', 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'Origin': 'https://' + nasHost,
                'Host': nasHost
            }
        });

        try {
            await client.connect();
            await client.login(config.username, config.password);
            
            // Get all services
            const listRes = await client.sendRequest('appcgi.sac.entry.v1.dockerList', {all: true});
            const servicesList = listRes.data?.list || [];

            let resultServices = [];
            let entryToken = null;

            if (isLocal) {
                // Local: Return local address + service port
                const localIp = nasData.ipv4 && nasData.ipv4.length > 0 ? nasData.ipv4[0] : nasHost;
                
                resultServices = servicesList.map(s => {
                    const port = s.uri?.port;
                    if (!port) return null;

                    return {
                        title: s.title || s.name,
                        url: `http://${localIp}:${port}`,
                        port: port,
                        alias: (s.title || s.name)+'_'+port
                    };
                }).filter(Boolean);
            } else {
                // External: Return external URL + entry-token
                const tokenRes = await client.sendRequest('appcgi.sac.entry.v1.exchangeEntryToken', {});
                entryToken = tokenRes.data.token;

                resultServices = servicesList.map(s => {
                    const fnDomain = s.uri?.fnDomain;
                    if (!fnDomain) return null;
// console.log('fnDomain:', s);
                    return {
                        title: s.title || s.name,
                        url: `https://${fnDomain}.${nasHost}`,
                        port: s.uri.port,
                        alias: (s.title || s.name)+'_'+s.uri.port,
                    };
                }).filter(Boolean);
            }

            client.close();

            const response = {
                success: true,
                services: resultServices
            };

            if (!isLocal && entryToken) {
                response.entryToken = entryToken;
            }

            return NextResponse.json(response);

        } catch (connError) {
             console.error('NAS Connection/Login Failed:', connError.message);
             return NextResponse.json({ success: false, error: 'NAS Connection Failed: ' + connError.message }, { status: 500 });
        }

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
