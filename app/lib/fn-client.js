import CryptoJS from 'crypto-js';
import JSEncrypt from 'jsencrypt';

// Try to import 'ws' for Node.js environment support
let WebSocketNode;
try {
    // Check if we are not in Edge Runtime
    if (typeof EdgeRuntime === 'undefined') {
        WebSocketNode = require('ws');
    }
} catch (e) {
    // Ignore error if module is missing or in Edge environment
}

export class FnOsClient {
    constructor(url, options = {}) {
        this.url = url;
        this.ws = null;
        this.reqIdIndex = 1;
        this.callbacks = new Map();
        this.backId = '0000000000000000';

        // Encryption keys
        this.key = this.generateRandomString(32);
        this.iv = CryptoJS.lib.WordArray.random(16);
        this.rsaPub = null;
        this.si = null;
        
        // Session info
        this.token = null;
        this.secret = null;

        this.logger = options.logger || console;
        this.headers = options.headers || {};
    }

    generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    getReqId() {
        const t = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
        const e = (this.reqIdIndex++).toString(16).padStart(4, '0');
        return `${t}${this.backId}${e}`;
    }

    generateEntryToken() {
        return CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
    }

    async connect() {
        let wsUrl = this.url;
        if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
            if (wsUrl.startsWith('http://')) wsUrl = wsUrl.replace('http://', 'ws://');
            else if (wsUrl.startsWith('https://')) wsUrl = wsUrl.replace('https://', 'wss://');
            else wsUrl = `wss://${wsUrl}`;
        }
        
        if (!wsUrl.includes('/websocket')) {
            wsUrl += '/websocket?type=main';
        }

        console.log('Connecting to WebSocket:', wsUrl);

        // Try fetch upgrade first (Cloudflare Workers/Pages specific)
        try {
            const resp = await fetch(wsUrl, {
                headers: {
                    'Upgrade': 'websocket',
                    'Connection': 'Upgrade',
                    ...this.headers
                }
            });

            if (resp.status === 101 && resp.webSocket) {
                this.logger.log('WebSocket connected via fetch upgrade');
                this.ws = resp.webSocket;
                this.ws.accept(); 
                
                return new Promise((resolve, reject) => {
                     this.ws.addEventListener('message', (event) => this.handleMessage(event.data));
                     this.ws.addEventListener('close', (event) => {
                         this.logger.log(`WebSocket closed: ${event.code} ${event.reason}`);
                     });
                     this.ws.addEventListener('error', (err) => {
                         this.logger.error('WebSocket error:', err);
                     });
                     resolve();
                });
            }
        } catch (fetchErr) {
            this.logger.log('Fetch upgrade failed, falling back to standard WebSocket:', fetchErr.message);
        }

        return new Promise((resolve, reject) => {
            try {
                // Priority: 'ws' (Node.js) > global WebSocket (Edge)
                if (WebSocketNode) {
                    this.logger.log('Using Node.js ws module');
                    this.ws = new WebSocketNode(wsUrl, {
                        headers: this.headers,
                        rejectUnauthorized: false
                    });

                    this.ws.on('open', () => {
                        this.logger.log('WebSocket connected (ws)');
                        resolve();
                    });

                    this.ws.on('error', (err) => {
                        this.logger.error('WebSocket error (ws):', err);
                        reject(new Error('WebSocket connection failed'));
                    });

                    this.ws.on('message', (data) => this.handleMessage(data));

                    this.ws.on('close', (code, reason) => {
                         this.logger.log(`WebSocket closed (ws): ${code} ${reason}`);
                    });
                } else {
                    // Use global WebSocket
                    this.logger.log('Using global WebSocket');
                    this.ws = new WebSocket(wsUrl);
                    
                    const connectionTimeout = setTimeout(() => {
                        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                            this.ws.close();
                            reject(new Error('WebSocket connection timeout'));
                        }
                    }, 10000);

                    this.ws.onopen = () => {
                        clearTimeout(connectionTimeout);
                        this.logger.log('WebSocket connected');
                        resolve();
                    };

                    this.ws.onerror = (err) => {
                        clearTimeout(connectionTimeout);
                        this.logger.error('WebSocket connection failed');
                        reject(new Error('WebSocket connection failed'));
                    };

                    this.ws.onmessage = (event) => this.handleMessage(event.data);

                    this.ws.onclose = (event) => {
                        clearTimeout(connectionTimeout);
                        this.logger.log(`WebSocket closed: ${event.code} ${event.reason}`);
                    };
                }
            } catch (e) {
                reject(e);
            }
        });
    }

    handleMessage(message) {
        try {
            const data = JSON.parse(message);
            if (data.reqid && this.callbacks.has(data.reqid)) {
                // console.log(`[WS] Resolving reqid: ${data.reqid}, result: ${data.result}`);
                const { resolve, reject } = this.callbacks.get(data.reqid);
                this.callbacks.delete(data.reqid);
                if (data.result === 'fail') {
                    reject(new Error(`Request failed: ${JSON.stringify(data)}`));
                } else {
                    resolve(data);
                }
            }
        } catch (e) {
            this.logger.error('Error parsing message:', e);
        }
    }

    getSignature(dataStr, key) {
        const keyWords = CryptoJS.enc.Base64.parse(key);
        const hmac = CryptoJS.HmacSHA256(dataStr, keyWords);
        return hmac.toString(CryptoJS.enc.Base64);
    }

    getSignatureReq(data, key) {
        const signReq = ['encrypted', 'util.getSI', 'util.crypto.getRSAPub'];
        const req = data.req;
        const jsonStr = JSON.stringify(data);
        if (!signReq.includes(req) && key) {
            const signature = this.getSignature(jsonStr, key);
            return signature + jsonStr;
        }
        return jsonStr;
    }

    aesDecrypt(ciphertext, key, iv) {
        const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        return decrypted.toString(CryptoJS.enc.Base64);
    }

    loginEncrypt(dataStr) {
        const keyWords = CryptoJS.enc.Utf8.parse(this.key);
        
        let rsaKey = this.rsaPub;
        if (!rsaKey.includes('-----BEGIN PUBLIC KEY-----')) {
             rsaKey = `-----BEGIN PUBLIC KEY-----\n${rsaKey}\n-----END PUBLIC KEY-----`;
        }

        const encryptor = new JSEncrypt();
        encryptor.setPublicKey(rsaKey);
        const rsaEncrypted = encryptor.encrypt(this.key);

        if (!rsaEncrypted) {
            throw new Error('RSA Encryption failed');
        }

        const encrypted = CryptoJS.AES.encrypt(dataStr, keyWords, {
            iv: this.iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        const aesEncrypted = encrypted.toString();

        return {
            req: 'encrypted',
            iv: this.iv.toString(CryptoJS.enc.Base64),
            rsa: rsaEncrypted,
            aes: aesEncrypted
        };
    }

    async sendRequest(req, params = {}) {
        const reqid = this.getReqId();
        let data = { reqid, req, ...params };
        
        console.log(`[WS] Sending request: ${req} (reqid: ${reqid})`);

        if (req === 'user.login' || req === 'user.add') {
            if (!this.rsaPub) throw new Error('RSA Public Key not available');
            const dataStr = JSON.stringify(data);
            const encrypted = this.loginEncrypt(dataStr);
            data = encrypted;
        }

        const message = this.getSignatureReq(data, this.secret);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.callbacks.has(reqid)) {
                    this.callbacks.delete(reqid);
                    reject(new Error(`Request timeout for ${req} (reqid: ${reqid})`));
                }
            }, 10000); 

            this.callbacks.set(reqid, { 
                resolve: (res) => { clearTimeout(timeout); resolve(res); }, 
                reject: (err) => { clearTimeout(timeout); reject(err); } 
            });

            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(message);
            } else {
                clearTimeout(timeout);
                reject(new Error('WebSocket not connected'));
            }
        });
    }

    async getRSAPub() {
        const res = await this.sendRequest('util.crypto.getRSAPub');
        if (res.result === 'succ' || res.result === 'success') {
            this.rsaPub = res.pub || (res.data && res.data.public_key);
            this.si = res.si || (res.data && res.data.si);
            console.log('[WS] Got RSA Pub:', this.rsaPub ? 'Yes' : 'No');
            return res;
        }
        throw new Error('Failed to get RSA Public Key: ' + JSON.stringify(res));
    }

    async login(username, password) {
        await this.getRSAPub();

        const params = {
            user: username,
            password: password, 
            deviceType: 'Browser', 
            deviceName: 'Edge Client',
            stay: true,
            si: this.si
        };

        const res = await this.sendRequest('user.login', params);
        if (res.result === 'succ') {
            this.token = res.token;
            try {
                const keyWords = CryptoJS.enc.Utf8.parse(this.key);
                const decryptedSecret = this.aesDecrypt(res.secret, keyWords, this.iv);
                this.secret = decryptedSecret;
            } catch (e) {
                console.log('Decrypt secret failed, using raw:', e.message);
                this.secret = res.secret;
            }
            this.backId = res.backId || this.backId;
            return res;
        }
        throw new Error(`Login failed: ${JSON.stringify(res)}`);
    }

    close() {
        if (this.ws) this.ws.close();
    }
}

// Helper: MD5 for signature (HTTP)
function md5(str) {
    return CryptoJS.MD5(str).toString(CryptoJS.enc.Hex);
}

// Helper: SHA256 for signature (HTTP)
function sha256(str) {
    return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}

function genSign(e, i) {
    const s = `trim_connect\`${e}\`${i}\`anna`;
    return sha256(s);
}

function genAuthX(url, method, paramsOrData) {
    const API_KEY = "zIGtkc3dqZnJpd29qZXJqa2w7c";
    const PREFIX = "NDzZTVxnRKP8Z0jXg1VAMonaG8akvh";
    let o = '';
    if (method.toLowerCase() === 'get') {
        const keys = Object.keys(paramsOrData || {}).sort();
        if (keys.length > 0) {
            o = keys.map(k => encodeURIComponent(k) + "=" + encodeURIComponent(paramsOrData[k])).join("&");
        }
    } else {
        o = JSON.stringify(paramsOrData);
    }
    const c = (Math.floor(Math.random() * 900000) + 100000).toString();
    const d = Date.now();
    const g = [PREFIX, url, c, d, md5(o), API_KEY].join("_");
    const sign = md5(g);
    return `nonce=${c}&timestamp=${d}&sign=${sign}`;
}

export async function fetchNasList(config) {
    const i = Date.now();
    const bodyData = { fnId: config.fnId };
    const fnSign = genSign(config.fnId, i);
    const authX = genAuthX('/api/v1/fn/con', 'post', bodyData);

    const response = await fetch('https://fnos.net/api/v1/fn/con', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'fn-sign': fnSign,
            'authx': authX
        },
        body: JSON.stringify(bodyData)
    });

    const responseData = await response.json();
    if (responseData.code === 0) {
        console.log('[API] Got NAS list:', responseData.data);
        return responseData.data;
    }
    throw new Error('Failed to get NAS list');
}
