import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

const stack = pulumi.getStack()
const config = new pulumi.Config()
const region = aws.config.region
if (!region) {
  throw new Error('The AWS provider region must be configured')
}

const accountId = '269909377461'
const projectTagValue = 'kimi-k2.5'
const expiryEnforcementTagValue = 'required'
const bucketName = `mythweavers-kimi-models-${accountId}-${region}`
const vpcId = config.require('vpcId')
const routeTableId = config.require('routeTableId')
const sshPublicKey = config.require('sshPublicKey')
const sshIngressCidr = config.require('sshIngressCidr')
const janitorSchedule = config.require('janitorSchedule')

const imported = (id: string): pulumi.CustomResourceOptions => ({
  import: id,
  protect: true,
})

const tags = {
  Project: projectTagValue,
  ManagedBy: 'Pulumi',
  Stack: stack,
}

const modelBucket = new aws.s3.BucketV2(
  'modelBucket',
  {
    bucket: bucketName,
    forceDestroy: false,
  },
  imported(bucketName),
)

new aws.s3.BucketPublicAccessBlock(
  'modelBucketPublicAccess',
  {
    bucket: modelBucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  },
  imported(bucketName),
)

new aws.s3.BucketServerSideEncryptionConfigurationV2(
  'modelBucketEncryption',
  {
    bucket: modelBucket.id,
    rules: [
      {
        applyServerSideEncryptionByDefault: {
          sseAlgorithm: 'AES256',
        },
        bucketKeyEnabled: false,
      },
    ],
  },
  imported(bucketName),
)

new aws.s3.BucketVersioningV2(
  'modelBucketVersioning',
  {
    bucket: modelBucket.id,
    versioningConfiguration: {
      status: 'Enabled',
    },
  },
  imported(bucketName),
)

const bootstrapObjects: Record<string, string> = {
  'kimi-k2.5/bootstrap/README.md': '../README.md',
  'kimi-k2.5/bootstrap/bin/kimi-bootstrap': '../bin/kimi-bootstrap',
  'kimi-k2.5/bootstrap/manifest.json': '../manifest.json',
  'kimi-k2.5/bootstrap/server-config.json': '../server-config.json',
  'kimi-k2.5/386fed8b054275941d6a495a9a7010fbf31b560d/manifest.json': '../manifest.json',
}

for (const [key, source] of Object.entries(bootstrapObjects)) {
  new aws.s3.BucketObjectv2(`artifact-${key.replaceAll(/[^a-zA-Z0-9]/g, '-')}`, {
    bucket: modelBucket.id,
    key,
    source: new pulumi.asset.FileAsset(source),
    serverSideEncryption: 'AES256',
  })
}

const modelReaderRole = new aws.iam.Role(
  'modelReaderRole',
  {
    name: 'kimi-k2-model-reader',
    description: 'Read-only Kimi model artifact access for ephemeral inference instances',
    maxSessionDuration: 3600,
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'ec2.amazonaws.com' },
          Action: 'sts:AssumeRole',
        },
      ],
    }),
  },
  imported('kimi-k2-model-reader'),
)

const modelReadPolicy = pulumi.jsonStringify({
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'ReadKimiModelArtifacts',
      Effect: 'Allow',
      Action: 's3:GetObject',
      Resource: pulumi.interpolate`${modelBucket.arn}/kimi-k2.5/*`,
    },
    {
      Sid: 'ListKimiModelPrefix',
      Effect: 'Allow',
      Action: 's3:ListBucket',
      Resource: modelBucket.arn,
      Condition: {
        StringLike: {
          's3:prefix': 'kimi-k2.5/*',
        },
      },
    },
  ],
})

new aws.iam.RolePolicy(
  'modelReadPolicy',
  {
    name: 'ReadKimiModelArtifacts',
    role: modelReaderRole.id,
    policy: modelReadPolicy,
  },
  imported('kimi-k2-model-reader:ReadKimiModelArtifacts'),
)

const modelReaderProfile = new aws.iam.InstanceProfile(
  'modelReaderProfile',
  {
    name: 'kimi-k2-model-reader',
    role: modelReaderRole.name,
  },
  imported('kimi-k2-model-reader'),
)

const s3Endpoint = new aws.ec2.VpcEndpoint(
  's3Endpoint',
  {
    vpcId,
    serviceName: `com.amazonaws.${region}.s3`,
    vpcEndpointType: 'Gateway',
    routeTableIds: [routeTableId],
  },
  imported('vpce-03b92eafe9467d51e'),
)

const inferenceSecurityGroup = new aws.ec2.SecurityGroup(
  'inferenceSecurityGroup',
  {
    name: 'kimi-ephemeral-ssh',
    description: 'Ephemeral Kimi validation SSH from Bart desktop only',
    vpcId,
    revokeRulesOnDelete: false,
    ingress: [
      {
        protocol: 'tcp',
        fromPort: 22,
        toPort: 22,
        cidrBlocks: [sshIngressCidr],
        description: 'Bart desktop temporary SSH',
      },
    ],
    egress: [
      {
        protocol: '-1',
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ['0.0.0.0/0'],
      },
    ],
  },
  imported('sg-0ce03306cf8e180b3'),
)

const inferenceKeyPair = new aws.ec2.KeyPair(
  'inferenceKeyPair',
  {
    keyName: 'kimi-rsa-20260831',
    publicKey: sshPublicKey,
  },
  imported('kimi-rsa-20260831'),
)

const janitorRole = new aws.iam.Role('janitorRole', {
  name: 'kimi-expiry-janitor',
  description: 'Terminates Kimi inference instances whose mandatory expiry is missing, invalid, or elapsed',
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: 'lambda.amazonaws.com' }),
  tags,
})

const janitorPolicy = aws.iam.getPolicyDocumentOutput({
  statements: [
    {
      sid: 'WriteFunctionLogs',
      effect: 'Allow',
      actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [pulumi.interpolate`arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/kimi-expiry-janitor:*`],
    },
    {
      sid: 'InspectAndTerminateKimiInstances',
      effect: 'Allow',
      actions: ['ec2:DescribeInstances'],
      resources: ['*'],
    },
    {
      sid: 'TerminateTaggedKimiInstances',
      effect: 'Allow',
      actions: ['ec2:TerminateInstances'],
      resources: [pulumi.interpolate`arn:aws:ec2:${region}:${accountId}:instance/*`],
      conditions: [
        {
          test: 'StringEquals',
          variable: 'ec2:ResourceTag/Project',
          values: [projectTagValue],
        },
        {
          test: 'StringEquals',
          variable: 'ec2:ResourceTag/ExpiryEnforcement',
          values: [expiryEnforcementTagValue],
        },
      ],
    },
  ],
})

new aws.iam.RolePolicy('janitorPolicy', {
  name: 'TerminateExpiredKimiInstances',
  role: janitorRole.id,
  policy: janitorPolicy.json,
})

const janitorLogGroup = new aws.cloudwatch.LogGroup('janitorLogGroup', {
  name: '/aws/lambda/kimi-expiry-janitor',
  tags,
})

const janitor = new aws.lambda.Function(
  'janitor',
  {
    name: 'kimi-expiry-janitor',
    description: 'Fail-closed expiry enforcement for ephemeral Kimi inference instances',
    role: janitorRole.arn,
    runtime: aws.lambda.Runtime.Python3d13,
    handler: 'janitor.handler',
    code: new pulumi.asset.AssetArchive({
      'janitor.py': new pulumi.asset.FileAsset('lambda/janitor.py'),
    }),
    environment: {
      variables: {
        PROJECT_TAG_VALUE: projectTagValue,
      },
    },
    tags,
  },
  { dependsOn: [janitorLogGroup] },
)

const janitorRule = new aws.cloudwatch.EventRule('janitorRule', {
  name: 'kimi-expiry-janitor',
  description: 'Periodically enforce mandatory expiration on Kimi experiment instances',
  scheduleExpression: janitorSchedule,
  state: 'ENABLED',
})

new aws.cloudwatch.EventTarget('janitorTarget', {
  rule: janitorRule.name,
  arn: janitor.arn,
})

new aws.lambda.Permission('allowEventBridgeJanitorInvocation', {
  action: 'lambda:InvokeFunction',
  function: janitor.name,
  principal: 'events.amazonaws.com',
  sourceArn: janitorRule.arn,
})

export const modelBucketName = modelBucket.bucket
export const modelReaderInstanceProfile = modelReaderProfile.name
export const s3VpcEndpointId = s3Endpoint.id
export const inferenceSecurityGroupId = inferenceSecurityGroup.id
export const inferenceKeyName = inferenceKeyPair.keyName
export const expiryJanitorFunctionName = janitor.name
export const requiredInstanceTags = {
  Project: projectTagValue,
  ExpiryEnforcement: expiryEnforcementTagValue,
  AutoTerminateAt: 'RFC3339 UTC timestamp ending in Z',
}
