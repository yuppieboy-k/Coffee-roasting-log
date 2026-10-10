declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  isFolder: boolean;
  webViewLink?: string;
}

const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

const TOKEN_KEY = 'roastcraft_gdrive_token_v1';
const TOKEN_EXPIRY_KEY = 'roastcraft_gdrive_token_expiry_v1';

class GoogleDriveService {
  private accessToken: string | null = null;
  private tokenClient: any = null;

  constructor() {
    this.restoreToken();
  }

  /**
   * Restores cached token from sessionStorage if still valid.
   */
  restoreToken(): string | null {
    try {
      const token = sessionStorage.getItem(TOKEN_KEY);
      const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
      if (token && expiry) {
        const expiresAt = Number(expiry);
        if (Date.now() < expiresAt) {
          this.accessToken = token;
          return token;
        } else {
          sessionStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
          this.accessToken = null;
        }
      }
    } catch {
      // sessionStorage might not be available
    }
    return null;
  }

  /**
   * Saves access token to memory and sessionStorage (default 55 minutes).
   */
  private saveToken(token: string, expiresInSec: number = 3300): void {
    this.accessToken = token;
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresInSec * 1000));
    } catch {
      // ignore
    }
  }

  hasValidToken(): boolean {
    if (this.accessToken) return true;
    return !!this.restoreToken();
  }

  getAccessToken(): string | null {
    if (this.accessToken) return this.accessToken;
    return this.restoreToken();
  }

  /**
   * Dynamically loads Google Identity Services and GAPI scripts.
   */
  async loadGoogleScripts(): Promise<boolean> {
    if (window.google?.accounts?.oauth2) {
      return true;
    }

    return new Promise((resolve) => {
      let gsiLoaded = false;
      let gapiLoaded = false;

      const checkBoth = () => {
        if (gsiLoaded && gapiLoaded) resolve(true);
      };

      if (!document.getElementById('google-gsi-script')) {
        const script = document.createElement('script');
        script.id = 'google-gsi-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          gsiLoaded = true;
          checkBoth();
        };
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      } else {
        gsiLoaded = true;
      }

      if (!document.getElementById('google-gapi-script')) {
        const script = document.createElement('script');
        script.id = 'google-gapi-script';
        script.src = 'https://apis.google.com/js/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          window.gapi.load('picker', () => {
            gapiLoaded = true;
            checkBoth();
          });
        };
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      } else {
        gapiLoaded = true;
      }

      setTimeout(() => resolve(!!window.google?.accounts?.oauth2), 3500);
    });
  }

  /**
   * Initializes OAuth Token Client with user's client ID.
   */
  initTokenClient(clientId: string, onTokenReceived?: (token: string) => void): void {
    if (!window.google?.accounts?.oauth2) {
      return;
    }

    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPES,
      callback: (tokenResponse: any) => {
        if (tokenResponse.error) {
          console.error('Google Auth error:', tokenResponse);
          return;
        }
        const token = tokenResponse.access_token;
        const expiresIn = tokenResponse.expires_in ? Number(tokenResponse.expires_in) : 3300;
        this.saveToken(token, expiresIn);
        if (onTokenReceived) {
          onTokenReceived(token);
        }
      },
    });
  }

  /**
   * Requests Google OAuth token popup or prompt.
   */
  async requestAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.tokenClient) {
        reject(new Error('Google OAuth client is not initialized. Please enter Client ID in Settings.'));
        return;
      }

      const originalCallback = this.tokenClient.callback;
      this.tokenClient.callback = (resp: any) => {
        if (originalCallback) originalCallback(resp);
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
        } else {
          const token = resp.access_token;
          const expiresIn = resp.expires_in ? Number(resp.expires_in) : 3300;
          this.saveToken(token, expiresIn);
          resolve(token);
        }
      };

      this.tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  /**
   * Resolves a folder input (which could be a folder ID, a folder name, or a Google Drive URL)
   * into an exact alphanumeric Google Drive folder ID.
   */
  async resolveFolderId(folderIdOrNameOrUrl?: string): Promise<string | undefined> {
    const token = this.getAccessToken();
    if (!token || !folderIdOrNameOrUrl?.trim()) return undefined;

    const input = folderIdOrNameOrUrl.trim();

    // 1. Check if user pasted a full Google Drive URL
    const urlMatch = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    // 2. If it's already an alphanumeric Drive ID (typically 25+ chars, no spaces)
    if (/^[a-zA-Z0-9_-]{20,}$/.test(input)) {
      return input;
    }

    // 3. Otherwise treat as a folder name and search Google Drive
    try {
      const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${input.replace(/'/g, "\\'")}' and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=5`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          return data.files[0].id;
        }
      }
    } catch (e) {
      console.warn('Could not resolve folder ID by name:', e);
    }

    return undefined;
  }

  /**
   * Lists folders in Google Drive for folder selection.
   */
  async listFolders(parentFolderId?: string): Promise<DriveItem[]> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Not connected to Google Drive');

    let q = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
    if (parentFolderId) {
      const resolvedParent = await this.resolveFolderId(parentFolderId);
      if (resolvedParent) {
        q += ` and '${resolvedParent}' in parents`;
      }
    }

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,modifiedTime)&pageSize=100&orderBy=name`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to list folders: ${res.statusText}`);
    }

    const data = await res.json();
    return (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      isFolder: true,
      modifiedTime: f.modifiedTime,
    }));
  }

  /**
   * Lists Artisan roast profile files (.alog, .json, .csv) inside a designated folder,
   * with automatic fallback to searching the entire Google Drive if folder is empty or not found.
   */
  async listArtisanFilesInFolder(folderIdOrNameOrUrl?: string): Promise<DriveItem[]> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('Not connected to Google Drive. Please authenticate in Settings or reconnect.');
    }

    const resolvedFolderId = await this.resolveFolderId(folderIdOrNameOrUrl);
    let items: DriveItem[] = [];

    const isArtisanFilename = (name: string) => {
      const lower = (name || '').toLowerCase();
      return (
        lower.endsWith('.alog') ||
        lower.endsWith('.json') ||
        lower.endsWith('.csv') ||
        lower.includes('.alog.') ||
        lower.includes('alog')
      );
    };

    // 1. If resolved folder exists, query all files in that folder
    if (resolvedFolderId) {
      try {
        const q = `'${resolvedFolderId}' in parents and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)&pageSize=100&orderBy=modifiedTime desc`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          items = (data.files || [])
            .filter((f: any) => isArtisanFilename(f.name))
            .map((f: any) => ({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              size: f.size,
              modifiedTime: f.modifiedTime,
              webViewLink: f.webViewLink,
              isFolder: false,
            }));
        }
      } catch (err) {
        console.warn('Listing within folder failed, falling back:', err);
      }
    }

    // 2. If folder query returned no .alog files, search the entire Google Drive
    if (items.length === 0) {
      try {
        const q = `trashed = false and (name contains 'alog' or name contains 'json' or name contains 'csv')`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)&pageSize=100&orderBy=modifiedTime desc`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          items = (data.files || [])
            .filter((f: any) => isArtisanFilename(f.name))
            .map((f: any) => ({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              size: f.size,
              modifiedTime: f.modifiedTime,
              webViewLink: f.webViewLink,
              isFolder: false,
            }));
        }
      } catch (err) {
        console.warn('Global Drive file search failed:', err);
      }
    }

    return items;
  }

  /**
   * Downloads raw text content of an Artisan file from Google Drive.
   */
  async downloadFileContent(fileId: string): Promise<string> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Not connected to Google Drive');

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to download file from Drive: ${res.statusText}`);
    }

    return await res.text();
  }

  /**
   * Trashes a file on Google Drive (used to clean up duplicates).
   */
  async trashFile(fileId: string): Promise<void> {
    const token = this.getAccessToken();
    if (!token) return;
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trashed: true }),
      });
    } catch {
      // ignore
    }
  }

  /**
   * Searches Google Drive for an existing coffee_roasting_app_data.json file.
   */
  async findAppDataFile(folderIdOrName?: string): Promise<DriveItem | null> {
    const token = this.getAccessToken();
    if (!token) return null;

    const resolvedFolderId = await this.resolveFolderId(folderIdOrName);
    const fileName = 'coffee_roasting_app_data.json';

    let q = `name = '${fileName}' and trashed = false`;
    if (resolvedFolderId) {
      q += ` and '${resolvedFolderId}' in parents`;
    }

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&pageSize=10&orderBy=modifiedTime desc`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      // If there are duplicate files, trash the older duplicates so only ONE file exists!
      if (data.files.length > 1) {
        for (let i = 1; i < data.files.length; i++) {
          this.trashFile(data.files[i].id).catch(() => {});
        }
      }
      return {
        id: data.files[0].id,
        name: data.files[0].name,
        mimeType: 'application/json',
        modifiedTime: data.files[0].modifiedTime,
        isFolder: false,
      };
    }

    // Fallback: search globally if not found in folder
    if (resolvedFolderId) {
      return this.findAppDataFile(undefined);
    }

    return null;
  }

  /**
   * Saves or updates the application JSON state file on Google Drive.
   * GUARANTEE: Updates the single existing file in-place with PATCH; cleans up any duplicates.
   */
  async syncAppDataToDrive(
    jsonData: string,
    folderIdOrName?: string,
    existingFileId?: string
  ): Promise<{ fileId: string; modifiedTime: string }> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Not connected to Google Drive');

    const fileName = 'coffee_roasting_app_data.json';
    const resolvedFolderId = await this.resolveFolderId(folderIdOrName);

    let targetFileId = existingFileId;

    // Check if target file exists on Drive
    if (!targetFileId) {
      const existing = await this.findAppDataFile(folderIdOrName);
      if (existing) {
        targetFileId = existing.id;
      }
    }

    // UPDATE IN-PLACE (PATCH) - No duplicate files created!
    if (targetFileId) {
      const url = `https://www.googleapis.com/upload/drive/v3/files/${targetFileId}?uploadType=media`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: jsonData,
      });

      if (res.ok) {
        const result = await res.json();
        return {
          fileId: result.id || targetFileId,
          modifiedTime: new Date().toISOString(),
        };
      }
      // If PATCH failed (e.g. file was deleted on Drive), fall through to recreate
      console.warn('Update in place failed, re-creating single file:', res.statusText);
    }

    // CREATE ONLY IF NO FILE EXISTS (POST)
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata: any = {
      name: fileName,
      mimeType: 'application/json',
    };
    if (resolvedFolderId) {
      metadata.parents = [resolvedFolderId];
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      jsonData +
      closeDelimiter;

    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!res.ok) {
      throw new Error(`Failed to save app data file: ${res.statusText}`);
    }

    const result = await res.json();
    return {
      fileId: result.id,
      modifiedTime: new Date().toISOString(),
    };
  }

  /**
   * Synchronizes all roast logs into a single Google Sheet (RoastCraft_Roast_Logs).
   * Automatically updates in-place if the Google Sheet already exists!
   */
  async syncLogsToGoogleSheet(
    csvData: string,
    folderIdOrName?: string,
    existingSheetId?: string
  ): Promise<{ sheetId: string; webViewLink?: string }> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Not connected to Google Drive');

    const sheetName = 'RoastCraft_Roast_Logs';
    const resolvedFolderId = await this.resolveFolderId(folderIdOrName);

    let targetSheetId = existingSheetId;

    // Search for existing sheet if not specified
    if (!targetSheetId) {
      let q = `name = '${sheetName}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
      if (resolvedFolderId) {
        q += ` and '${resolvedFolderId}' in parents`;
      }
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&pageSize=1`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          targetSheetId = searchData.files[0].id;
        }
      }
    }

    // UPDATE IN-PLACE (PATCH)
    if (targetSheetId) {
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${targetSheetId}?uploadType=media`;
      const res = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/csv; charset=UTF-8',
        },
        body: csvData,
      });

      if (res.ok) {
        const result = await res.json();
        return {
          sheetId: result.id || targetSheetId,
          webViewLink: `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`,
        };
      }
    }

    // CREATE NEW GOOGLE SHEET (POST)
    const boundary = '-------sheetboundary314159';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata: any = {
      name: sheetName,
      mimeType: 'application/vnd.google-apps.spreadsheet', // Converts CSV directly to a Google Sheet!
    };
    if (resolvedFolderId) {
      metadata.parents = [resolvedFolderId];
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: text/csv; charset=UTF-8\r\n\r\n' +
      csvData +
      closeDelimiter;

    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!res.ok) {
      throw new Error(`Failed to create Google Sheet: ${res.statusText}`);
    }

    const result = await res.json();
    return {
      sheetId: result.id,
      webViewLink: `https://docs.google.com/spreadsheets/d/${result.id}/edit`,
    };
  }
}

export const googleDriveService = new GoogleDriveService();
