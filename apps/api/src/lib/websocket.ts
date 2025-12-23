import { WebSocketServer, WebSocket } from 'ws';
import { FastifyInstance } from 'fastify';
import { logger } from './logger';

interface WebSocketClient {
  ws: WebSocket;
  userId: string;
  channels: Set<string>;
  lastPing: number;
}

interface ChatMessage {
  type: 'message' | 'typing' | 'read' | 'join' | 'leave';
  channelId: string;
  senderId: string;
  data: any;
  timestamp: number;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private channelSubscribers: Map<string, Set<string>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize WebSocket server
   */
  initialize(server: FastifyInstance['server']) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Start ping interval to detect dead connections
    this.pingInterval = setInterval(() => {
      this.pingClients();
    }, 30000);

    logger.info('WebSocket server initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: any) {
    // Extract user ID from query string or auth header
    const url = new URL(req.url || '', 'ws://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    // TODO: Validate token and get user ID
    const userId = this.validateToken(token);
    if (!userId) {
      ws.close(4002, 'Invalid token');
      return;
    }

    const clientId = `${userId}-${Date.now()}`;

    const client: WebSocketClient = {
      ws,
      userId,
      channels: new Set(),
      lastPing: Date.now(),
    };

    this.clients.set(clientId, client);
    logger.info({ userId, clientId }, 'WebSocket client connected');

    ws.on('message', (data) => {
      this.handleMessage(clientId, data.toString());
    });

    ws.on('close', () => {
      this.handleDisconnect(clientId);
    });

    ws.on('error', (error) => {
      logger.error({ error, clientId }, 'WebSocket error');
    });

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastPing = Date.now();
      }
    });

    // Send welcome message
    this.send(clientId, {
      type: 'connected',
      data: { clientId, userId },
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(clientId: string, rawData: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const message = JSON.parse(rawData);

      switch (message.type) {
        case 'subscribe':
          this.subscribeToChannel(clientId, message.channelId);
          break;

        case 'unsubscribe':
          this.unsubscribeFromChannel(clientId, message.channelId);
          break;

        case 'message':
          this.broadcastToChannel(message.channelId, {
            type: 'message',
            channelId: message.channelId,
            senderId: client.userId,
            data: message.data,
            timestamp: Date.now(),
          }, clientId);
          break;

        case 'typing':
          this.broadcastToChannel(message.channelId, {
            type: 'typing',
            channelId: message.channelId,
            senderId: client.userId,
            data: { isTyping: message.isTyping },
            timestamp: Date.now(),
          }, clientId);
          break;

        case 'read':
          this.broadcastToChannel(message.channelId, {
            type: 'read',
            channelId: message.channelId,
            senderId: client.userId,
            data: { messageId: message.messageId },
            timestamp: Date.now(),
          }, clientId);
          break;

        default:
          logger.warn({ type: message.type }, 'Unknown message type');
      }
    } catch (error) {
      logger.error({ error, rawData }, 'Failed to parse WebSocket message');
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Unsubscribe from all channels
    for (const channelId of client.channels) {
      this.unsubscribeFromChannel(clientId, channelId);

      // Notify channel about leave
      this.broadcastToChannel(channelId, {
        type: 'leave',
        channelId,
        senderId: client.userId,
        data: {},
        timestamp: Date.now(),
      });
    }

    this.clients.delete(clientId);
    logger.info({ clientId, userId: client.userId }, 'WebSocket client disconnected');
  }

  /**
   * Subscribe client to a channel
   */
  private subscribeToChannel(clientId: string, channelId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.channels.add(channelId);

    if (!this.channelSubscribers.has(channelId)) {
      this.channelSubscribers.set(channelId, new Set());
    }
    this.channelSubscribers.get(channelId)!.add(clientId);

    // Notify channel about join
    this.broadcastToChannel(channelId, {
      type: 'join',
      channelId,
      senderId: client.userId,
      data: {},
      timestamp: Date.now(),
    });

    logger.debug({ clientId, channelId }, 'Client subscribed to channel');
  }

  /**
   * Unsubscribe client from a channel
   */
  private unsubscribeFromChannel(clientId: string, channelId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.channels.delete(channelId);

    const subscribers = this.channelSubscribers.get(channelId);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.channelSubscribers.delete(channelId);
      }
    }

    logger.debug({ clientId, channelId }, 'Client unsubscribed from channel');
  }

  /**
   * Broadcast message to all clients in a channel
   */
  broadcastToChannel(channelId: string, message: ChatMessage, excludeClientId?: string) {
    const subscribers = this.channelSubscribers.get(channelId);
    if (!subscribers) return;

    const payload = JSON.stringify(message);

    for (const clientId of subscribers) {
      if (clientId === excludeClientId) continue;
      this.sendRaw(clientId, payload);
    }
  }

  /**
   * Broadcast message to a specific user (all their connections)
   */
  broadcastToUser(userId: string, message: any) {
    const payload = JSON.stringify(message);

    for (const [clientId, client] of this.clients) {
      if (client.userId === userId) {
        this.sendRaw(clientId, payload);
      }
    }
  }

  /**
   * Send message to a specific client
   */
  send(clientId: string, message: any) {
    this.sendRaw(clientId, JSON.stringify(message));
  }

  /**
   * Send raw message to a specific client
   */
  private sendRaw(clientId: string, payload: string) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(payload);
    } catch (error) {
      logger.error({ error, clientId }, 'Failed to send WebSocket message');
    }
  }

  /**
   * Ping all clients to detect dead connections
   */
  private pingClients() {
    const now = Date.now();
    const timeout = 60000; // 1 minute

    for (const [clientId, client] of this.clients) {
      if (now - client.lastPing > timeout) {
        // Client hasn't responded to ping, disconnect
        logger.warn({ clientId }, 'Client ping timeout, disconnecting');
        client.ws.terminate();
        this.handleDisconnect(clientId);
      } else if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      }
    }
  }

  /**
   * Validate authentication token
   * TODO: Implement proper token validation
   */
  private validateToken(token: string): string | null {
    // In production, verify JWT token here
    // For now, just extract user ID from token
    try {
      // Placeholder: token is just the user ID
      return token;
    } catch {
      return null;
    }
  }

  /**
   * Get connection stats
   */
  getStats() {
    return {
      totalConnections: this.clients.size,
      totalChannels: this.channelSubscribers.size,
      connectionsByUser: this.getConnectionsByUser(),
    };
  }

  /**
   * Get connections grouped by user
   */
  private getConnectionsByUser(): Record<string, number> {
    const byUser: Record<string, number> = {};
    for (const client of this.clients.values()) {
      byUser[client.userId] = (byUser[client.userId] || 0) + 1;
    }
    return byUser;
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutting down');
    }

    this.clients.clear();
    this.channelSubscribers.clear();

    if (this.wss) {
      this.wss.close();
    }

    logger.info('WebSocket server shut down');
  }
}

export const wsManager = new WebSocketManager();
