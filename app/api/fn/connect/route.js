import { NextResponse } from 'next/server';
import { FnOsClient, fetchNasList } from '../../../lib/fn-client';

// 全局鉴权密钥，用于 API 调用校验
// 请修改此处的密钥或设置环境变量 GLOBAL_AUTH_KEY
const GLOBAL_AUTH_KEY = process.env.GLOBAL_AUTH_KEY || 'sk_random_key_123456';

async function handler(request) {
    try {
        let body = {};
        
        // Parse parameters from URL query string
        const url = new URL(request.url);
        const queryParams = Object.fromEntries(url.searchParams);
        
        // Only use query params, ignore body
        body = queryParams;

        const { username, password, port, fnId, key } = body;

        // 全局密钥鉴权
        if (key !== GLOBAL_AUTH_KEY) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Invalid key' }, { status: 401 });
        }
        
        if (!username || !password || !port || !fnId) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const config = { fnId, username, password, port };

        console.log('Connecting to NAS for port:', config.port);
        
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
            
            const tokenRes = await client.sendRequest('appcgi.sac.entry.v1.exchangeEntryToken', {});
            const entryToken = tokenRes.data.token;
            
            const listRes = await client.sendRequest('appcgi.sac.entry.v1.dockerList', {all: true});
            const matched = listRes.data?.list?.find(c => Number(c?.uri?.port) === Number(config.port));
            client.close();

            if (matched?.uri?.fnDomain) {
                const targetUrl = `https://${matched.uri.fnDomain}.${nasHost}`;
                
                // Return result directly
                return NextResponse.json({ 
                    success: true, 
                    token: entryToken, 
                    url: targetUrl 
                });
            }

            return NextResponse.json({ success: false, error: 'App not found on port ' + config.port }, { status: 404 });

        } catch (connError) {
             console.error('NAS Connection/Login Failed:', connError.message);
             return NextResponse.json({ success: false, error: 'NAS Connection Failed: ' + connError.message }, { status: 500 });
        }

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export { handler as GET, handler as POST };
