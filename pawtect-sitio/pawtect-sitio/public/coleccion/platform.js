// Public entry point listed in the PAWTECT project presentation.
// Replace individual destinations when the platform exposes stable deep links.
(() => {
  const home = "https://pawtect-pawtect-sitio.vercel.app/";
  window.platformLinks = Object.freeze({
    home,
    login: home,
    join: home,
    report: home,
    wellbeing: home,
    contact: home
  });
})();
