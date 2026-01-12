import { NextResponse } from 'next/server';
import { FnOsClient, fetchNasList } from '../../../lib/fn-client';

// 全局鉴权密钥，用于 API 调用校验
// 请修改此处的密钥或设置环境变量 GLOBAL_AUTH_KEY
const GLOBAL_AUTH_KEY = process.env.GLOBAL_AUTH_KEY || 'sk_random_key_123456';

export async function POST(request) {
    try {
        let body = {};
        try {
            body = await request.json();
        } catch (e) {
            return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
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
