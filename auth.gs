// ============================================================================
// AUTH.GS - PetPooja Authentication & Session Management
// ============================================================================
// Handles login and session persistence for PetPooja

let sessionCookies = '';

// Authenticate with PetPooja using email and password
function authenticateWithPetPooja() {
  try {
    const creds = getCredentials();

    if (!creds.email || !creds.password) {
      throw new Error('Credentials not configured. Set PETPOOJA_EMAIL and PETPOOJA_PASSWORD in Script Properties.');
    }

    Logger.log('Attempting PetPooja login...');

    // Prepare login form data
    const payload = {
      email: creds.email,
      password: creds.password,
      'remember-me': 'on'
    };

    // URLFetch options for login
    const options = {
      method: 'post',
      payload: payload,
      followRedirects: true,
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    // Attempt login
    const response = UrlFetchApp.fetch(CONFIG.PETPOOJA_LOGIN_URL, options);
    const responseCode = response.getResponseCode();

    Logger.log('Login response code: ' + responseCode);

    // Check if login was successful
    if (responseCode === 200 || responseCode === 302) {
      // Extract cookies from response headers
      const headers = response.getAllHeaders();
      const setCookieHeaders = headers['Set-Cookie'];

      if (setCookieHeaders) {
        if (Array.isArray(setCookieHeaders)) {
          sessionCookies = setCookieHeaders.map(h => h.split(';')[0]).join('; ');
        } else {
          sessionCookies = setCookieHeaders.split(';')[0];
        }
        Logger.log('Session cookies established');
        return true;
      } else {
        Logger.log('No cookies received but HTTP 200/302 - trying without cookies');
        return true;
      }
    } else {
      throw new Error(`Login failed with response code: ${responseCode}`);
    }
  } catch (e) {
    const errorMsg = 'Authentication Error: ' + e.message;
    Logger.log(errorMsg);
    logToSheet('ERROR', 'Authentication Failed', e.message);
    sendErrorEmail('Authentication Failed', `Could not login to PetPooja:\n\n${e.message}\n\nPlease verify your credentials in Script Properties.`);
    throw e;
  }
}

// Get authenticated session for making requests
function getAuthenticatedHeaders() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  if (sessionCookies) {
    headers['Cookie'] = sessionCookies;
  }

  return headers;
}

// Test if authentication is still valid
function testAuthentication() {
  try {
    const options = {
      method: 'get',
      headers: getAuthenticatedHeaders(),
      followRedirects: false,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(CONFIG.PETPOOJA_REPORT_URL, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      Logger.log('Authentication test passed');
      return true;
    } else if (responseCode === 302 || responseCode === 401) {
      Logger.log('Authentication test failed - re-authenticating needed');
      return false;
    }

    return true;
  } catch (e) {
    Logger.log('Authentication test error: ' + e);
    return false;
  }
}
