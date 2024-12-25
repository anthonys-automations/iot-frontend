// __tests__/UsersDBReader.test.js
const { v4: uuidv4 } = require('uuid');

// Mock uuid to return predictable values
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mock-uuid')
}));

// Simple mock for auth module
jest.mock('../src/scripts/auth', () => ({
    createCosmosClient: jest.fn()
}));

const { createCosmosClient } = require('../src/scripts/auth');
const UsersDBReader = require('../src/scripts/users-db-reader');

describe('UsersDBReader', () => {
    let dbReader;
    let mockDatabase;
    let mockContainer;
    let mockQuery;
    let mockFetchAll;
    let mockRead;
    let mockReplace;
    let mockCreate;

    beforeEach(() => {
        jest.clearAllMocks();

        // Set up mock chain
        mockFetchAll = jest.fn();
        mockQuery = jest.fn().mockReturnValue({ fetchAll: mockFetchAll });
        mockRead = jest.fn();
        mockReplace = jest.fn();
        mockCreate = jest.fn();

        // Mock container operations
        mockContainer = {
            read: jest.fn(),
            items: {
                query: mockQuery,
                create: mockCreate
            },
            item: jest.fn().mockReturnValue({
                read: mockRead,
                replace: mockReplace
            })
        };

        mockDatabase = {
            container: jest.fn().mockReturnValue(mockContainer)
        };

        // Set up the createCosmosClient mock
        createCosmosClient.mockReturnValue({
            database: jest.fn().mockReturnValue(mockDatabase)
        });

        dbReader = new UsersDBReader('fake-endpoint', 'fake-db');
    });

    describe('constructor', () => {
        it('should initialize with correct parameters', () => {
            expect(createCosmosClient).toHaveBeenCalledWith('fake-endpoint', 'fake-db');
        });
    });

    describe('verifyContainer', () => {
        it('should log container ID on success', async () => {
            mockContainer.read.mockResolvedValueOnce({
                resource: { id: 'users' }
            });

            await dbReader.verifyContainer();
            expect(mockContainer.read).toHaveBeenCalledTimes(1);
        });

        it('should throw an error if container read fails', async () => {
            mockContainer.read.mockRejectedValueOnce(new Error('read failed'));
            await expect(dbReader.verifyContainer()).rejects.toThrow('read failed');
        });
    });

    describe('findUserByAuth', () => {
        it('should return the first user if found', async () => {
            const mockUser = {
                id: 'user123',
                realName: 'Test User',
                emailAddress: 'test@example.com',
                authMethods: [{ type: 'google', id: 'google-123' }]
            };

            mockFetchAll.mockResolvedValueOnce({
                resources: [mockUser]
            });

            const result = await dbReader.findUserByAuth('google', 'google-123');
            expect(mockQuery).toHaveBeenCalledWith({
                query: 'SELECT * FROM c WHERE ARRAY_CONTAINS(c.authMethods, { "type": @authType, "id": @authId })',
                parameters: [
                    { name: '@authType', value: 'google' },
                    { name: '@authId', value: 'google-123' }
                ]
            });
            expect(result).toEqual(mockUser);
        });

        it('should return undefined if no user is found', async () => {
            mockFetchAll.mockResolvedValueOnce({
                resources: []
            });

            const result = await dbReader.findUserByAuth('google', 'google-123');
            expect(result).toBeUndefined();
        });

        it('should throw if the query fails', async () => {
            mockFetchAll.mockRejectedValueOnce(new Error('Query failed'));
            await expect(dbReader.findUserByAuth('google', 'google-123')).rejects.toThrow('Query failed');
        });
    });

    describe('createUser', () => {
        it('should create and return the new user', async () => {
            const expectedUser = {
                id: 'mock-uuid',
                realName: 'Test User',
                emailAddress: 'test@example.com',
                authMethods: [{ type: 'google', id: 'google-123' }],
                createdAt: expect.any(String)
            };

            mockCreate.mockResolvedValueOnce({
                resource: expectedUser
            });

            const result = await dbReader.createUser(
                'Test User',
                'test@example.com',
                'google',
                'google-123'
            );

            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
                id: 'mock-uuid',
                realName: 'Test User',
                emailAddress: 'test@example.com',
                authMethods: [{ type: 'google', id: 'google-123' }],
                createdAt: expect.any(String)
            }));
            expect(result).toEqual(expectedUser);
        });

        it('should throw if creation fails', async () => {
            mockCreate.mockRejectedValueOnce(new Error('Creation failed'));
            await expect(
                dbReader.createUser('Test User', 'test@example.com', 'google', 'google-123')
            ).rejects.toThrow('Creation failed');
        });
    });

    describe('addAuthMethod', () => {
        it('should add an auth method to an existing user', async () => {
            // Mock that no user exists with this auth method
            mockFetchAll.mockResolvedValueOnce({
                resources: []
            });

            // Mock existing user
            const existingUser = {
                id: 'some-user',
                authMethods: []
            };

            // Mock reading the existing user
            mockRead.mockResolvedValueOnce({
                resource: existingUser
            });

            // Mock updating the user
            const updatedUser = {
                ...existingUser,
                authMethods: [{ type: 'google', id: 'new-auth' }]
            };
            mockReplace.mockResolvedValueOnce({
                resource: updatedUser
            });

            const result = await dbReader.addAuthMethod('some-user', 'google', 'new-auth');
            expect(result).toEqual(updatedUser);
            expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({
                authMethods: [{ type: 'google', id: 'new-auth' }]
            }));
        });

        it('should throw if the auth method is already in use', async () => {
            mockFetchAll.mockResolvedValueOnce({
                resources: [{ id: 'other-user' }]
            });

            await expect(
                dbReader.addAuthMethod('some-user', 'google', 'used-auth')
            ).rejects.toThrow('This authentication method is already linked to another account');
        });

        it('should throw if read fails', async () => {
            mockFetchAll.mockResolvedValueOnce({ resources: [] });
            mockRead.mockRejectedValueOnce(new Error('Read error'));

            await expect(
                dbReader.addAuthMethod('some-user', 'google', 'new-auth')
            ).rejects.toThrow('Read error');
        });

        it('should throw if replace fails', async () => {
            mockFetchAll.mockResolvedValueOnce({ resources: [] });
            mockRead.mockResolvedValueOnce({
                resource: { id: 'some-user', authMethods: [] }
            });
            mockReplace.mockRejectedValueOnce(new Error('Replace error'));

            await expect(
                dbReader.addAuthMethod('some-user', 'google', 'new-auth')
            ).rejects.toThrow('Replace error');
        });
    });
});
