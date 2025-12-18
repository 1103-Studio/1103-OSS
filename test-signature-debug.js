// Node.js 脚本：生成正确的 AWS Signature V4 并测试
const crypto = require('crypto');

const accessKey = 'AKIAMXTQDA4ZWISCZVUK';
const secretKey = 'mSYgH7KnWsejNZ5imUowbP8p3pfT80xeryPI1Z';
const region = 'us-east-1';
const service = 's3';

// 获取当前时间
const now = new Date();
const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
const dateStamp = amzDate.substring(0, 8);

const method = 'GET';
const host = 'localhost:9000';
const uri = '/';
const queryString = '';
const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // 空字符串的 SHA256

// 构建规范请求头
const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

// 构建规范请求
const canonicalRequest = [
  method,
  uri,
  queryString,
  canonicalHeaders,
  signedHeaders,
  payloadHash
].join('\n');

console.log('=== Canonical Request ===');
console.log(canonicalRequest);
console.log('');

// 计算规范请求的哈希
const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');

// 构建待签名字符串
const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
const stringToSign = [
  'AWS4-HMAC-SHA256',
  amzDate,
  credentialScope,
  canonicalRequestHash
].join('\n');

console.log('=== String to Sign ===');
console.log(stringToSign);
console.log('');

// 计算签名密钥
function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  return kSigning;
}

const signingKey = getSignatureKey(secretKey, dateStamp, region, service);
const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

console.log('=== Signature ===');
console.log(signature);
console.log('');

// 构建 Authorization 头
const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

console.log('=== Authorization Header ===');
console.log(authorization);
console.log('');

// 生成 curl 命令
const curlCommand = `curl -i http://${host}/ \\
  -H "Authorization: ${authorization}" \\
  -H "X-Amz-Date: ${amzDate}" \\
  -H "X-Amz-Content-Sha256: ${payloadHash}"`;

console.log('=== Test Command ===');
console.log(curlCommand);
console.log('');
