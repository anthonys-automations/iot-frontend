# API Documentation

## Overview
This document provides an overview of the API endpoints available in the application.

## Endpoints

### 1. Get Devices
- **Method:** `GET`
- **URL:** `/api/devices`
- **Description:** Fetches a list of devices from the Cosmos DB.
- **Response:**
  - **200 OK:** Returns an array of devices.
  - **500 Internal Server Error:** If there is an error fetching devices.

---

### 2. Get Device Details
- **Method:** `GET`
- **URL:** `/api/device-details`
- **Query Parameters:**
  - `source` (string, required): The source of the device.
  - `parameter` (string, required): The parameter to fetch details for.
  - `startTime` (string, optional): The start time in ISO format.
  - `endTime` (string, optional): The end time in ISO format.
- **Description:** Fetches detailed information about a specific device.
- **Response:**
  - **200 OK:** Returns device details.
  - **400 Bad Request:** If the query parameters are invalid.
  - **404 Not Found:** If no data is found.
  - **500 Internal Server Error:** If there is an error fetching device details.

---

### 4. Get Current User
- **Method:** `GET`
- **URL:** `/api/current-user`
- **Description:** Retrieves the current authenticated user's information.
- **Response:**
  - **200 OK:** Returns user information if authenticated.
  - **401 Unauthorized:** If no client principal is found.

---

### 5. User Signup
- **Method:** `POST`
- **URL:** `/api/signup`
- **Request Body:**
  - `realName` (string, required): The real name of the user.
  - `emailAddress` (string, required): The email address of the user.
  - `authType` (string, required): The type of authentication.
  - `authId` (string, required): The authentication ID.
- **Description:** Creates a new user in the database.
- **Response:**
  - **200 OK:** Returns success message and user information.
  - **400 Bad Request:** If the email address is missing.
  - **500 Internal Server Error:** If there is an error during signup.

---

### 6. Get Device Parameters
- **Method:** `GET`
- **URL:** `/api/device-parameters`
- **Query Parameters:**
  - `source` (string, required): The source of the device.
- **Description:** Fetches parameters for a specific device source.
- **Response:**
  - **200 OK:** Returns an array of device parameters.
  - **400 Bad Request:** If the query parameters are invalid.
  - **500 Internal Server Error:** If there is an error fetching parameters.

---

## Notes
- Ensure to handle errors appropriately in your application.
- All date parameters should be in ISO format.
