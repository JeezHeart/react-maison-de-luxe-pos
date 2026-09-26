import { useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useUIStore } from '../../stores/uiStore.js';

// Restaurant branding details. Stored in this browser only (localStorage), not
// synced, so it describes the terminal rather than the business.
export default function RestaurantProfileCard({ className = '' }) {
  const saved = useSettingsStore();
  const saveSettings = useSettingsStore((s) => s.save);
  const resetSettings = useSettingsStore((s) => s.reset);
  const showToast = useUIStore((s) => s.showToast);

  // Seeded from the store once on mount; editing is local until Save is pressed.
  const [restaurantName, setRestaurantName] = useState(saved.restaurantName);
  const [contact, setContact] = useState(saved.contact);
  const [address, setAddress] = useState(saved.address);

  const handleSave = () => {
    saveSettings({ restaurantName, contact, address });
    showToast('Settings saved successfully.');
  };

  const handleReset = () => {
    resetSettings();
    setRestaurantName('Maison de Luxe');
    setContact('');
    setAddress('');
    showToast('Settings reset.');
  };

  return (
    <div className={`settings-box ${className}`.trim()}>
      <h6 className="mb-2">Restaurant Profile</h6>
      <p className="text-muted text-sm mb-3">
        Save branding details used in this POS dashboard (saved in browser).
      </p>

      <div className="mb-2">
        <label htmlFor="settingRestaurantName" className="field-label">
          Restaurant Name
        </label>
        <input
          type="text"
          id="settingRestaurantName"
          className="field-control"
          placeholder="Maison de Luxe"
          value={restaurantName}
          onChange={(e) => setRestaurantName(e.target.value)}
        />
      </div>
      <div className="mb-2">
        <label htmlFor="settingContact" className="field-label">
          Contact Number
        </label>
        <input
          type="text"
          id="settingContact"
          className="field-control"
          placeholder="+63 912 345 6789"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
      </div>
      <div className="mb-3">
        <label htmlFor="settingAddress" className="field-label">
          Address
        </label>
        <input
          type="text"
          id="settingAddress"
          className="field-control"
          placeholder="City, Country"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          id="saveSettingsBtn"
          className="btn-primary-pos btn-sm-pos"
          onClick={handleSave}
        >
          Save Settings
        </button>
        <button
          type="button"
          id="resetSettingsBtn"
          className="btn-outline-secondary-pos btn-sm-pos"
          onClick={handleReset}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
