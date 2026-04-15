const fs = require('fs');
const path = require('path');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

function getUploadsRoot() {
  return path.resolve(__dirname, '..', '..', 'uploads', 'admin-issue-claims');
}

function sanitizeFileName(value) {
  return String(value || 'asset')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function getExtensionForMimeType(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image payload.');
  }

  return {
    mimeType: match[1],
    base64Payload: match[2]
  };
}

async function persistIssueClaimImage(issueId, label, filePayload = {}) {
  if (!filePayload || typeof filePayload !== 'object') {
    return null;
  }

  const { mimeType, base64Payload } = parseDataUrl(filePayload.data);
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error('Only JPG, PNG and WEBP images are allowed.');
  }

  const fileBuffer = Buffer.from(base64Payload, 'base64');
  if (!fileBuffer.length) {
    throw new Error('Uploaded image is empty.');
  }

  if (fileBuffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Uploaded image exceeds the 5 MB limit.');
  }

  const issueDirectory = path.join(getUploadsRoot(), issueId);
  await fs.promises.mkdir(issueDirectory, { recursive: true });

  const extension = getExtensionForMimeType(mimeType);
  const originalName = sanitizeFileName(filePayload.name || `${label}.${extension}`);
  const fileName = `${Date.now()}-${label}.${extension}`;
  const absoluteFilePath = path.join(issueDirectory, fileName);

  await fs.promises.writeFile(absoluteFilePath, fileBuffer);

  return {
    uploaded: true,
    mimeType,
    name: originalName,
    size: fileBuffer.length,
    url: `/uploads/admin-issue-claims/${issueId}/${fileName}`.replace(/\\/g, '/')
  };
}

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  persistIssueClaimImage
};
