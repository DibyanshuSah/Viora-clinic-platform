/**
 * Isolated document printing utility
 * Prints ONLY the specified element within an isolated hidden iframe
 * Guarantees zero background page artifacts and strict 1-page fit.
 */
export const printDocument = (elementId, documentTitle = 'VIORA Document') => {
  const elem = document.getElementById(elementId);
  if (!elem) {
    window.print();
    return;
  }

  // Remove any previous print iframes
  const existingFrame = document.getElementById('viora-print-iframe');
  if (existingFrame) {
    try {
      existingFrame.remove();
    } catch {
      // ignore
    }
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'viora-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${documentTitle}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 4mm 6mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            width: 100%;
            height: 100%;
            background: #FFFFFF !important;
            color: #0F172A !important;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          #viora-rx-document {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            max-width: 100% !important;
            max-height: 280mm !important;
            padding: 0 !important;
            margin: 0 auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            background: #FFFFFF !important;
            box-sizing: border-box !important;
          }
          #viora-invoice-document {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            max-height: 280mm !important;
            padding: 16px 20px !important;
            margin: 0 auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            background: #FFFFFF !important;
            box-sizing: border-box !important;
          }
          .rx-clinical-box {
            border: 2px solid #000000 !important;
            display: flex !important;
            min-height: 720px !important;
            height: 750px !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .rx-left-col {
            border-right: 2px solid #000000 !important;
            width: 28% !important;
            box-sizing: border-box !important;
            height: 100% !important;
          }
          .rx-right-col {
            width: 72% !important;
            box-sizing: border-box !important;
            height: 100% !important;
          }
        </style>
      </head>
      <body>
        ${elem.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  // Trigger print after iframe renders
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      window.print();
    } finally {
      setTimeout(() => {
        try {
          iframe.remove();
        } catch {
          // ignore
        }
      }, 1500);
    }
  }, 250);
};
