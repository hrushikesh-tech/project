import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ConfigService } from '@nestjs/config';

const require = createRequire(import.meta.url);
const { PayslipPdfService } = require('../../dist/src/payroll/pdf/payslip-pdf.service.js');
const { PayslipStorageService } = require('../../dist/src/payroll/storage/payslip-storage.service.js');

function resolveChromePath() {
  return process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_BIN ||
    [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ].find((candidate) => existsSync(candidate));
}

test('browser-backed payslip PDF is generated and uploaded through the S3 client path', async (t) => {
  const chromePath = resolveChromePath();
  if (!chromePath) {
    t.skip('Chrome/Edge binary not available for browser-backed PDF verification.');
    return;
  }

  let receivedRequest;
  let receivedBody = Buffer.alloc(0);

  const server = http.createServer((req, res) => {
    receivedRequest = {
      method: req.method,
      url: req.url,
      contentType: req.headers['content-type'],
    };
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      receivedBody = Buffer.concat(chunks);
      res.statusCode = 200;
      res.setHeader('etag', '"test-etag"');
      res.end();
    });
  });

  t.after(async () => {
    server.close();
    await once(server, 'close');
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  const config = new ConfigService({
    AWS_REGION: 'us-east-1',
    AWS_S3_BUCKET: 'test-bucket',
    AWS_ACCESS_KEY_ID: 'testing',
    AWS_SECRET_ACCESS_KEY: 'testing',
    AWS_S3_ENDPOINT: `http://127.0.0.1:${port}`,
    AWS_S3_FORCE_PATH_STYLE: 'true',
    PUPPETEER_EXECUTABLE_PATH: chromePath,
  });

  const pdfService = new PayslipPdfService(config);
  const pdf = await pdfService.renderPayslip({
    employeeName: 'Amdox Employee',
    period: '2026-04',
    grossPayMinor: 9000000n,
    netPayMinor: 8015500n,
    earnings: [{ code: 'BASIC', amountMinor: 6000000n }],
    deductions: [{ code: 'INCOME_TAX', amountMinor: 845000n }],
    taxBreakdown: { regime: 'NEW', annualTaxMinor: 10140000n, monthlyTaxMinor: 845000n },
  });

  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');

  const storageService = new PayslipStorageService(config);
  const stored = await storageService.uploadPayslip({
    tenantId: 'tenant-1',
    payrollRunId: 'run-1',
    employeeId: 'employee-1',
    body: pdf,
  });

  assert.equal(stored.bucket, 'test-bucket');
  assert.equal(stored.key, 'payslips/tenant-1/run-1/employee-1.pdf');
  assert.equal(receivedRequest.method, 'PUT');
  assert.equal(receivedRequest.url, '/test-bucket/payslips/tenant-1/run-1/employee-1.pdf?x-id=PutObject');
  assert.equal(receivedRequest.contentType, 'application/pdf');
  assert.equal(receivedBody.subarray(0, 4).toString(), '%PDF');
});
