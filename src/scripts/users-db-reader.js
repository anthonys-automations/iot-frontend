const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { v4: uuidv4 } = require('uuid');

class UsersDBReader {
    constructor(endpoint, databaseId) {
        let proxyAgent = null;
        if (process.env.http_proxy) {
            proxyAgent = new HttpsProxyAgent(process.env.http_proxy);
        }

        this.client = new CosmosClient({
            endpoint,
            agent: proxyAgent,
            aadCredentials: new DefaultAzureCredential()
        });
        this.databaseId = databaseId;
        this.containerId = "users";

        console.log(`Initializing UsersDBReader with endpoint: ${endpoint}, database: ${databaseId}, container: ${this.containerId}`);
        
        this.verifyContainer().catch(error => {
            console.error('Failed to verify users container:', error);
        });
    }

    async verifyContainer() {
        try {
            const database = this.client.database(this.databaseId);
            const { resource: container } = await database.container(this.containerId).read();
            console.log('Users container verified:', container.id);
        } catch (error) {
            console.error(`Users container not found or not accessible: ${error.message}`);
            throw error;
        }
    }

    async findUserByAuth(authType, authId) {
        console.log(`Searching for user with authType: ${authType}, authId: ${authId}`);
        try {
            const database = this.client.database(this.databaseId);
            const container = database.container(this.containerId);
            const query = {
                query: 'SELECT * FROM c WHERE ARRAY_CONTAINS(c.authMethods, { "type": @authType, "id": @authId })',
                parameters: [
                    { name: '@authType', value: authType },
                    { name: '@authId', value: authId }
                ]
            };
            const { resources: items } = await container.items.query(query).fetchAll();
            console.log(`Found ${items.length} matching users`);
            return items[0];
        } catch (error) {
            console.error(`Error finding user: ${error.message}`);
            throw error;
        }
    }

    async createUser(realName, emailAddress, authType, authId) {
        console.log(`Creating user with email: ${emailAddress}, authType: ${authType}`);
        try {
            const database = this.client.database(this.databaseId);
            const container = database.container(this.containerId);
            
            const newUser = {
                id: uuidv4(),
                realName: realName || '',
                emailAddress: emailAddress,
                authMethods: [{
                    type: authType,
                    id: authId
                }],
                createdAt: new Date().toISOString()
            };

            const { resource: createdUser } = await container.items.create(newUser);
            console.log('User created successfully:', createdUser.id);
            return createdUser;
        } catch (error) {
            console.error(`Error creating user: ${error.message}`);
            throw error;
        }
    }

    async addAuthMethod(userId, authType, authId) {
        console.log(`Adding auth method to user ${userId}: ${authType}`);
        try {
            const database = this.client.database(this.databaseId);
            const container = database.container(this.containerId);
            
            const existingUser = await this.findUserByAuth(authType, authId);
            if (existingUser) {
                throw new Error('This authentication method is already linked to another account');
            }

            const { resource: user } = await container.item(userId, userId).read();
            user.authMethods.push({
                type: authType,
                id: authId
            });
            
            const { resource: updatedUser } = await container.item(userId, userId).replace(user);
            console.log('Auth method added successfully');
            return updatedUser;
        } catch (error) {
            console.error(`Error adding auth method: ${error.message}`);
            throw error;
        }
    }
}

module.exports = UsersDBReader; 