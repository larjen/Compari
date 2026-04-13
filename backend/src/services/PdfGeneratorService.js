const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class PdfGeneratorService {
    static async generateMatchReport(matchId) {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        const frontendUrl = `http://localhost:3001/print/match/${matchId}`;

        await page.goto(frontendUrl, { waitUntil: 'networkidle0', timeout: 30000 });

        // 1. Resolve path to the frontend public directory and read the SVG
        const logoPath = path.join(__dirname, '../../../frontend/public/compari.svg');
        let logoBase64 = '';
        if (fs.existsSync(logoPath)) {
            const logoBuffer = fs.readFileSync(logoPath);
            logoBase64 = `data:image/svg+xml;base64,${logoBuffer.toString('base64')}`;
        }

        // 2. Generate PDF with Base64 injected footer
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>', // Empty header
            footerTemplate: `
                <div style="width: 100%; font-size: 10px; color: #666; display: flex; justify-content: space-between; align-items: center; padding: 0 20mm 5mm 20mm; font-family: sans-serif; box-sizing: border-box;">
                    <a href="https://github.com/larjen/Compari" style="display: flex; align-items: center; gap: 8px; text-decoration: none; color: inherit;">
                        ${logoBase64 ? `<img src="${logoBase64}" style="height: 14px; opacity: 0.8;" />` : ''}
                        <span style="opacity: 0.7;">Highly experimental AI matching engine, crafted by AI agents orchestrated by Lars Jensen in 2026.</span>
                    </a>
                    
                    <div>Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
                </div>
            `,
            margin: {
                top: '20mm',
                bottom: '20mm', // Room for the footer
                left: '20mm',
                right: '20mm'
            }
        });

        await browser.close();
        return pdfBuffer;
    }
}

module.exports = PdfGeneratorService;