/* SAHROUD License Client — no private keys in browser.
 * The production API must validate and sign entitlements server-side.
 */
export class SahroudLicenseClient {
  constructor({ productId, apiBase, storageKey = 'sahroud.license.token' }) {
    this.productId = productId;
    this.apiBase = apiBase;
    this.storageKey = storageKey;
  }
  getToken() {
    try { return localStorage.getItem(this.storageKey) || ''; } catch { return ''; }
  }
  saveToken(token) {
    if (typeof token !== 'string' || !token.trim()) throw new Error('کد مجوز معتبر نیست');
    localStorage.setItem(this.storageKey, token.trim());
  }
  clearToken() { localStorage.removeItem(this.storageKey); }
  async activate(licenseCode, installationId) {
    const response = await fetch(this.apiBase + '/v1/licenses/activate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: this.productId, licenseCode, installationId })
    });
    if (!response.ok) throw new Error('فعال‌سازی انجام نشد: ' + response.status);
    const result = await response.json();
    if (!result.token) throw new Error('پاسخ سرور فاقد توکن مجوز است');
    this.saveToken(result.token);
    return result.entitlements || {};
  }
  async validate() {
    const token = this.getToken();
    if (!token) return { tier: 'FREE', features: [] };
    const response = await fetch(this.apiBase + '/v1/licenses/validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ productId: this.productId })
    });
    if (!response.ok) return { tier: 'FREE', features: [], invalid: true };
    return response.json();
  }
}
