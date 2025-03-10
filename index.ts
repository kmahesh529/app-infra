import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs";
const config = new pulumi.Config();
const domainName = config.require("domainName");
const certificateArn = config.require("certificateArn");
const siteBucket = new aws.s3.Bucket("siteBucket", {
    website: { indexDocument: "index.html" },
    forceDestroy: true,
});

const indexHtml = new aws.s3.BucketObject("indexHtml", {
    bucket: siteBucket,
    source: new pulumi.asset.FileAsset("index.html"),
    contentType: "text/html",
});
const bucketPolicy = new aws.s3.BucketPolicy("bucketPolicy", {
    bucket: siteBucket.id,
    policy: siteBucket.id.apply(id => JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: "*",
            Action: "s3:GetObject",
            Resource: `arn:aws:s3:::${id}/*`,
        }],
    })),
});

const oai = new aws.cloudfront.OriginAccessIdentity("oai");
const cdn = new aws.cloudfront.Distribution("cdn", {
    enabled: true,
    origins: [{
        domainName: siteBucket.bucketRegionalDomainName,
        originId: siteBucket.id,
        s3OriginConfig: { originAccessIdentity: oai.cloudfrontAccessIdentityPath },
    }],
    defaultCacheBehavior: {
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD"],
        cachedMethods: ["GET", "HEAD"],
        targetOriginId: siteBucket.id,
        forwardedValues: { queryString: false, cookies: { forward: "none" } },
    },
    viewerCertificate: {
        acmCertificateArn: certificateArn,
        sslSupportMethod: "sni-only",
    },
    restrictions: {
        geoRestriction: {
            restrictionType: "none",
        },
    },
});

// outputs
export const bucketName = siteBucket.bucket;
export const cloudFrontUrl = cdn.domainName;
