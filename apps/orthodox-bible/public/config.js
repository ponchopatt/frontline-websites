// Inside the App Store and Google Play apps the pages come from the phone itself, so the calendar
// is fetched from the live website instead. Put your Vercel address here before building them.
window.OB_SITE = ""; // e.g. "https://your-app.vercel.app/"
if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) window.OB_API = window.OB_SITE;
