import {
  GetObjectCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

let s3Api: S3Client | undefined
const getClient = () => {
  if (s3Api) {
    return s3Api
  }
  s3Api = new S3Client({
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.CLOUDFLARE_S3_SECRET_ACCESS_KEY ?? '',
    },
    region: 'auto',
    endpoint: process.env.CLOUDFLARE_S3_ENDPOINT ?? '',
  })
  return s3Api
}

export const headFile = async (path: string): Promise<HeadObjectCommandOutput> => {
  const client = getClient()
  const response = await client.send(
    new HeadObjectCommand({
      Bucket: 'writer2',
      Key: path,
    }),
  )
  return response
}

export const uploadFile = async (data: Buffer, path: string, contentType: string): Promise<void> => {
  const client = getClient()
  await client.send(
    new PutObjectCommand({
      Bucket: 'writer2',
      Key: path,
      Body: data,
      ContentType: contentType,
    }),
  )
}

export const downloadFile = async (path: string): Promise<Buffer> => {
  const client = getClient()
  const response = await client.send(
    new GetObjectCommand({
      Bucket: 'writer2',
      Key: path,
    }),
  )
  if (!response.Body) {
    throw new Error('No body in response')
  }
  return Buffer.from(await response.Body.transformToByteArray())
}
