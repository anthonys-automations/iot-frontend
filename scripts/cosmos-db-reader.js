const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');
const HttpsProxyAgent = require('https-proxy-agent');

class CosmosDBReader {
    constructor(endpoint, databaseId, containerId) {
        console.log(`Initializing CosmosDBReader with endpoint: ${endpoint}, databaseId: ${databaseId}, containerId: ${containerId}`);

        // Use proxy settings from environment variables
        const http_proxy = process.env.http_proxy;
        const proxyAgent = new HttpsProxyAgent(http_proxy);

        this.client = new CosmosClient({
            endpoint,
            agent: proxyAgent,
            // key: "fOcC1URYChAu4KeS4WTxvz8kl1GdkhjM2FX5JdU8VzbJuttKcd78YE7RETvTNdOuSHAmDskVAsQCACDb1TkzCg=="
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
            const { resources: items } = await container.items.query('SELECT DISTINCT c.Properties.source FROM c ORDER BY c.Properties.source').fetchAll();
            console.log(`Fetched device sources: ${JSON.stringify(items, null, 2)}`);
            return items;
        } catch (error) {
            console.error(`Error fetching device sources: ${error.message}`);
            throw error;
        }
    }

    async getDeviceDetails(source) {
      try {
          console.log(`Fetching device details for source: ${source}`);
          const database = this.client.database(this.databaseId);
          const container = database.container(this.containerId);
          const query = {
              query: 'SELECT * FROM c WHERE c.Properties.source = @source',
              parameters: [{ name: '@source', value: source }]
          };
          const { resources: items } = await container.items.query(query).fetchAll();
        //   console.log(`Fetched device details: ${JSON.stringify(items, null, 2)}`);
          return items;
      } catch (error) {
          console.error(`Error fetching device details: ${error.message}`);
          throw error;
      }
  }
}

module.exports = CosmosDBReader;
