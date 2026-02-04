#!/usr/bin/env node

/**
 * Spec Hub Client
 * 
 * Handles all interactions with Postman Spec Hub API.
 * Uses native fetch with Postman API key authentication.
 */

import fs from 'fs';

const POSTMAN_API_BASE = 'https://api.getpostman.com';

class SpecHubClient {
  constructor(apiKey, workspaceId) {
    this.apiKey = apiKey;
    this.workspaceId = workspaceId;
  }

  /**
   * Make authenticated API request
   */
  async request(method, endpoint, body = null) {
    const url = `${POSTMAN_API_BASE}${endpoint}`;
    const options = {
      method,
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${JSON.stringify(data.error || data)}`);
    }

    return data;
  }

  /**
   * Upload or update spec in Spec Hub
   */
  async uploadSpec(name, specContent, specId = null) {
    const payload = {
      name,
      type: 'OPENAPI:3.0',
      files: [
        {
          path: 'index.json',
          content: typeof specContent === 'string' ? specContent : JSON.stringify(specContent)
        }
      ]
    };

    if (specId) {
      // Update existing spec
      await this.request('PATCH', `/specs/${specId}/files/index.json`, {
        content: payload.files[0].content
      });
      return specId;
    } else {
      // Create new spec
      const result = await this.request('POST', `/specs?workspaceId=${this.workspaceId}`, payload);
      return result.id;
    }
  }

  /**
   * Get collections generated from a spec
   */
  async getSpecGeneratedCollections(specId) {
    try {
      const result = await this.request('GET', `/specs/${specId}/generations/collection`);
      return result.collections || [];
    } catch (error) {
      // If endpoint doesn't exist or returns error, return empty array
      return [];
    }
  }

  /**
   * Generate or sync collection from spec
   * 
   * If collection with same name exists for this spec, sync it.
   * Otherwise, generate a new collection.
   */
  async generateOrSyncCollection(specId, name, options = {}) {
    // First, check if a collection with this name already exists for this spec
    const existingCollections = await this.getSpecGeneratedCollections(specId);
    const existingCollection = existingCollections.find(c => c.name === name);

    if (existingCollection) {
      // Collection exists, sync it with the spec
      // The ID from spec generations is just the collection ID
      // We need to find the full UID from the collections list
      console.log(`  Syncing existing collection: ${existingCollection.id}`);
      await this.syncCollectionWithSpec(existingCollection.id, specId);
      
      // Wait for sync to complete
      await this.waitForCollectionSync(existingCollection.id);
      
      // Find the full UID from collections list
      const collections = await this.request('GET', `/collections?workspace=${this.workspaceId}`);
      const collection = collections.collections?.find(c => c.name === name);
      
      if (!collection) {
        throw new Error(`Synced collection "${name}" not found`);
      }
      
      return collection.uid;
    }

    // No existing collection, generate new one
    console.log(`  Generating new collection: ${name}`);
    const payload = {
      name,
      options: {
        enableOptionalParameters: options.enableOptionalParameters ?? true,
        folderStrategy: options.folderStrategy || 'Tags',
        ...options
      }
    };

    await this.request(
      'POST',
      `/specs/${specId}/generations/collection`,
      payload
    );

    // Collection generation is async, wait for it to complete
    await this.waitForCollectionGeneration(name);

    // Find and return the generated collection
    const collections = await this.request('GET', `/collections?workspace=${this.workspaceId}`);
    const collection = collections.collections?.find(c => c.name === name);

    if (!collection) {
      throw new Error(`Generated collection "${name}" not found`);
    }

    return collection.uid;
  }

  /**
   * Sync collection with spec
   */
  async syncCollectionWithSpec(collectionId, specId) {
    return this.request(
      'PUT',
      `/collections/${collectionId}/synchronizations?specId=${specId}`
    );
  }

  /**
   * Wait for collection sync to complete
   */
  async waitForCollectionSync(collectionId, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if collection still exists and is accessible
      try {
        const collection = await this.getCollection(collectionId);
        if (collection) {
          return;
        }
      } catch (error) {
        // Collection might be temporarily unavailable during sync
        console.log(`  Waiting for sync... (${i + 1}/${maxAttempts})`);
      }
    }

    console.warn(`  Sync wait timed out, but collection should be updated`);
  }

  /**
   * Wait for collection generation to complete
   */
  async waitForCollectionGeneration(name, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const collections = await this.request('GET', `/collections?workspace=${this.workspaceId}`);
      const collection = collections.collections?.find(c => c.name === name);

      if (collection) {
        return;
      }
    }

    throw new Error(`Collection generation timed out after ${maxAttempts * 2} seconds`);
  }

  /**
   * Get collection details
   */
  async getCollection(collectionUid) {
    return this.request('GET', `/collections/${collectionUid}`);
  }

  /**
   * Update collection
   */
  async updateCollection(collectionUid, collection) {
    return this.request('PUT', `/collections/${collectionUid}`, { collection });
  }

  /**
   * Add test scripts to collection requests
   */
  async addTestScripts(collectionUid, testScripts) {
    const collectionData = await this.getCollection(collectionUid);
    const collection = collectionData.collection;

    // Recursively add tests to all request items
    this.addTestsToItems(collection.item, testScripts);

    // Update the collection
    await this.updateCollection(collectionUid, collection);

    return collection;
  }

  /**
   * Recursively add test scripts to collection items
   */
  addTestsToItems(items, testScripts) {
    for (const item of items) {
      if (item.request) {
        // This is a request item, add tests
        const testScript = testScripts[item.name] || testScripts['default'];
        if (testScript) {
          item.event = item.event || [];
          
          // Remove existing test events
          item.event = item.event.filter(e => e.listen !== 'test');
          
          // Add new test event
          item.event.push({
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: Array.isArray(testScript) ? testScript : testScript.split('\n')
            }
          });
        }
      }

      if (item.item) {
        // Recurse into folders
        this.addTestsToItems(item.item, testScripts);
      }
    }
  }

  /**
   * Delete spec
   */
  async deleteSpec(specId) {
    return this.request('DELETE', `/specs/${specId}`);
  }

  /**
   * Delete collection
   */
  async deleteCollection(collectionUid) {
    return this.request('DELETE', `/collections/${collectionUid}`);
  }

  /**
   * List specs in workspace
   */
  async listSpecs() {
    const result = await this.request('GET', `/specs?workspaceId=${this.workspaceId}`);
    return result.specs || [];
  }

  /**
   * Find spec by name
   */
  async findSpecByName(name) {
    const specs = await this.listSpecs();
    return specs.find(s => s.name === name);
  }
}

export default SpecHubClient;
export { SpecHubClient };
