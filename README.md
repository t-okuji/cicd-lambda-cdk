# CDK + CodeCommit + CodeBuild + CodePipeline + ECR

This is a project for Deploying Lambda functions.

## Diagrams

![AWS Diagrams](/drawio/cicd-lambda-cdk.svg)

## Run pipeline

Add buildspec.yml to your project and push to CodeCommit.
Refer to `buildspec_sample.yml`.

## Useful commands

* `bun run build`   compile typescript to js
* `bun run watch`   watch for changes and compile
* `bun run test`    perform the jest unit tests
* `bunx cdk deploy`  deploy this stack to your default AWS account/region
* `bunx cdk diff`    compare deployed stack with current state
* `bunx cdk synth`   emits the synthesized CloudFormation template
