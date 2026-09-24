// All user-editable deployment values live in public/config.js.
const values=globalThis.LIBRARY_CONFIG||{};
export const GOOGLE_CLIENT_ID=values.GOOGLE_CLIENT_ID||'';
export const GOOGLE_DRIVE_FOLDER_ID=values.GOOGLE_DRIVE_FOLDER_ID||'';
export const ALLOWED_EMAILS=(values.ALLOWED_EMAILS||[]).map(email=>email.toLowerCase());
export const PARENT_EMAILS=(values.PARENT_EMAILS||[]).map(email=>email.toLowerCase());
export const configured=GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com')&&!GOOGLE_CLIENT_ID.startsWith('YOUR_')&&/^[\w-]+$/.test(GOOGLE_DRIVE_FOLDER_ID)&&!GOOGLE_DRIVE_FOLDER_ID.startsWith('YOUR_');
