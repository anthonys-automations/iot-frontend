
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');
const HttpsProxyAgent = require('https-proxy-agent');

class CosmosDBReader {
    constructor(endpoint, databaseId, containerId) {
//        const http_proxy = process.env.http_proxy;
//        const proxyAgent = new HttpsProxyAgent(http_proxy);

        this.client = new CosmosClient({
            endpoint,
//            agent: proxyAgent,
            aadCredentials: new DefaultAzureCredential()
        });
        this.databaseId = databaseId;
        this.containerId = containerId;
    }

    async getDeviceSources() {
        try {
            console.log(`Fetching device sources from database: ${this.databaseId}, container: ${this.containerId}`);
            const database = this.client.database(this.databaseId);
            const container = database.container(this.containerId);
            const { resources: items } = await container.items.query('SELECT DISTINCT c.source FROM c ORDER BY c.source').fetchAll();
            console.log(`Fetched device sources: ${JSON.stringify(items, null, 2)}`);
            return items;
        } catch (error) {
            console.error(`Error fetching device sources: ${error.message}`);
            throw error;
        }
    }

    async getDeviceDetails(source, month) {
        try {
          console.log(`Fetching device details for source: ${source} and month: ${month}`);
          const database = this.client.database(this.databaseId);
          const container = database.container(this.containerId);
          const query = {
            query: 'SELECT c.timestamp,c.Body FROM c WHERE c.source = @source AND c.month = @month ORDER BY c.timestamp',
            parameters: [
              { name: '@source', value: source },
              { name: '@month', value: month }
            ]
          };
          const { resources: items } = await container.items.query(query).fetchAll();
          return items;
        } catch (error) {
          console.error(`Error fetching details for source: ${source} and month: ${month} - ${error.message}`);
          throw error;
        }
      }
      
  async getDistinctMonths(source) {
      try {
          const database = this.client.database(this.databaseId);
          const container = database.container(this.containerId);
          const query = {
              query: 'SELECT DISTINCT c.month FROM c WHERE c.source = @source ORDER BY c.month DESC',
              parameters: [{ name: '@source', value: source }]
          };
          const { resources: items } = await container.items.query(query).fetchAll();
          return items.map(item => item.month);
      } catch (error) {
          console.error(`Error fetching months for source ${source}: ${error.message}`);
          throw error;
      }
  }
}

module.exports = CosmosDBReader;
