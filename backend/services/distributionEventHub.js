// distributionEventHub.js
// In-memory Real-Time Event Hub using Server-Sent Events (SSE)
// Organizes client connections strictly by organizationId and campaignId

class DistributionEventHub {
  constructor() {
    // Map of "organizationId:campaignId" -> Set of client objects
    // Client object: { id, res, userId, organizationId, campaignId }
    this.rooms = new Map();

    // Periodic heartbeat to prevent proxies/browsers from dropping idle connections
    this.heartbeatInterval = setInterval(() => {
      this.broadcastHeartbeat();
    }, 25000);

    // Ensure timer doesn't keep node process alive in tests
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  _roomKey(organizationId, campaignId) {
    return `${organizationId.toString()}:${campaignId.toString()}`;
  }

  /**
   * Register a new connected client to an organization campaign room
   */
  subscribe(organizationId, campaignId, client) {
    const key = this._roomKey(organizationId, campaignId);
    if (!this.rooms.has(key)) {
      this.rooms.set(key, new Set());
    }
    this.rooms.get(key).add(client);
  }

  /**
   * Remove a client when their connection closes
   */
  unsubscribe(organizationId, campaignId, clientId) {
    const key = this._roomKey(organizationId, campaignId);
    if (!this.rooms.has(key)) return;

    const clients = this.rooms.get(key);
    for (const client of clients) {
      if (client.id === clientId) {
        clients.delete(client);
        break;
      }
    }

    if (clients.size === 0) {
      this.rooms.delete(key);
    }
  }

  /**
   * Publish an event strictly to clients connected to the matching organizationId and campaignId
   */
  publish(organizationId, campaignId, eventData) {
    const key = this._roomKey(organizationId, campaignId);
    const clients = this.rooms.get(key);
    if (!clients || clients.size === 0) return 0;

    const payload = `data: ${JSON.stringify(eventData)}\n\n`;
    let deliveredCount = 0;

    for (const client of clients) {
      try {
        client.res.write(payload);
        if (typeof client.res.flush === 'function') {
          client.res.flush();
        }
        deliveredCount++;
      } catch (err) {
        // Error writing to closed socket; remove client
        clients.delete(client);
      }
    }

    return deliveredCount;
  }

  /**
   * Send SSE comment keep-alive ping to all active connections
   */
  broadcastHeartbeat() {
    const ping = ': ping\n\n';
    for (const [key, clients] of this.rooms.entries()) {
      for (const client of clients) {
        try {
          client.res.write(ping);
          if (typeof client.res.flush === 'function') {
            client.res.flush();
          }
        } catch (err) {
          clients.delete(client);
        }
      }
      if (clients.size === 0) {
        this.rooms.delete(key);
      }
    }
  }

  /**
   * Helper to get connected client count for a room
   */
  getClientCount(organizationId, campaignId) {
    const key = this._roomKey(organizationId, campaignId);
    const clients = this.rooms.get(key);
    return clients ? clients.size : 0;
  }
}

// Export singleton instance
const distributionEventHub = new DistributionEventHub();
module.exports = distributionEventHub;
