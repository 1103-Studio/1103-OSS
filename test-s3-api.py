#!/usr/bin/env python3
import boto3
from botocore.client import Config
import sys

# 远程 OSS 服务配置
endpoint = 'http://oss.spark-ai.top:19000'
access_key = 'AKIAZBLXFB7ZXCB4PPRF'
secret_key = 'GSJjqWE3mPLOxRn2PQChJDH60m2qaZREHj3u7l'
region = 'us-east-1'

print("=== 连接到远程 OSS 服务 ===")
print(f"Endpoint: {endpoint}")
print(f"Access Key: {access_key}")
print()

# 创建 S3 客户端
s3 = boto3.client(
    's3',
    endpoint_url=endpoint,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
    region_name=region,
    config=Config(signature_version='s3v4')
)

try:
    # 1. 列出所有存储桶
    print("=== 1. 列出所有存储桶 ===")
    response = s3.list_buckets()
    buckets = response.get('Buckets', [])
    if buckets:
        for bucket in buckets:
            print(f"  - {bucket['Name']} (创建于: {bucket['CreationDate']})")
    else:
        print("  当前没有存储桶")
    print()

    # 2. 创建新存储桶
    bucket_name = 'test-bucket-remote'
    print(f"=== 2. 创建存储桶: {bucket_name} ===")
    try:
        s3.create_bucket(Bucket=bucket_name)
        print(f"✅ 存储桶 '{bucket_name}' 创建成功")
    except Exception as e:
        if 'BucketAlreadyOwnedByYou' in str(e) or 'BucketAlreadyExists' in str(e):
            print(f"ℹ️  存储桶 '{bucket_name}' 已存在，继续测试...")
        else:
            raise
    print()

    # 3. 上传文件
    print("=== 3. 上传测试文件 ===")
    test_content = "这是一个测试文件！\n时间戳: $(date)\nOSS 服务测试成功！"
    object_key = 'test-file.txt'
    
    s3.put_object(
        Bucket=bucket_name,
        Key=object_key,
        Body=test_content.encode('utf-8'),
        ContentType='text/plain'
    )
    print(f"✅ 文件 '{object_key}' 上传成功")
    print()

    # 4. 列出存储桶中的对象
    print(f"=== 4. 列出存储桶 '{bucket_name}' 中的对象 ===")
    response = s3.list_objects_v2(Bucket=bucket_name)
    objects = response.get('Contents', [])
    if objects:
        for obj in objects:
            print(f"  - {obj['Key']} ({obj['Size']} bytes)")
    else:
        print("  存储桶为空")
    print()

    # 5. 下载文件
    print(f"=== 5. 下载文件 '{object_key}' ===")
    response = s3.get_object(Bucket=bucket_name, Key=object_key)
    content = response['Body'].read().decode('utf-8')
    print("文件内容:")
    print(content)
    print()

    # 6. 生成预签名 URL
    print("=== 6. 生成预签名 URL (有效期 1 小时) ===")
    url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': bucket_name, 'Key': object_key},
        ExpiresIn=3600
    )
    print(f"预签名 URL: {url}")
    print()

    print("✅ 所有测试通过！远程 OSS 服务运行正常。")
    
except Exception as e:
    print(f"❌ 测试失败: {e}")
    sys.exit(1)
