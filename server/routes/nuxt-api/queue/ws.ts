// 號碼牌 WebSocket：依 query merchantId 加入 peer Map，廣播 CALL_NEXT / TICKET_DONE 等事件
// 認證策略：MVP 不鑑權；號碼牌為店面公開資訊，寫入動作仍需走 HTTP + merchant token
import { defineWebSocketHandler } from 'h3';
import { addPeer, removePeer } from '@@/utils/queue';

const parseMerchantId = (url: string): string | null => {
  try {
    const u = new URL(url, 'http://localhost');
    const id = u.searchParams.get('merchantId');
    if (!id || id.length > 64) return null;
    return id;
  } catch {
    return null;
  }
};

export default defineWebSocketHandler({
  open(peer) {
    const url = peer.request?.url ?? '';
    const merchantId = parseMerchantId(typeof url === 'string' ? url : '');
    if (!merchantId) {
      peer.close(1008, 'merchantId required');
      return;
    }
    // 把 merchantId 暫存到 context，close 時用來清理
    peer.context.merchantId = merchantId;
    addPeer(merchantId, peer);
    try {
      peer.send(JSON.stringify({ type: 'HELLO', merchantId, timestamp: Date.now() }));
    } catch {
      // ignore
    }
  },

  message(peer, message) {
    // 心跳：客戶端送 'ping' 字串，回 'pong'
    const text = message.text();
    if (text === 'ping') {
      try { peer.send('pong'); } catch { /* ignore */ }
    }
  },

  close(peer) {
    const merchantId = peer.context?.merchantId as string | undefined;
    if (merchantId) removePeer(merchantId, peer);
  },

  error(peer) {
    const merchantId = peer.context?.merchantId as string | undefined;
    if (merchantId) removePeer(merchantId, peer);
  }
});
