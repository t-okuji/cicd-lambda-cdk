import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as codecommit from "aws-cdk-lib/aws-codecommit";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as dotenv from "dotenv";

dotenv.config();

export class CicdLambdaCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const resourceName = "cicd-lambda";

    // CodeCommit repository
    const codeRepository = new codecommit.Repository(this, "CodeRepository", {
      repositoryName: `${resourceName}-code-repository`,
    });

    // ECR repository
    const ecrRepository = new ecr.Repository(this, "EcrRepository", {
      repositoryName: `${resourceName}-ecr-repository`,
      imageScanOnPush: false,
      // Max 2 images
      lifecycleRules: [
        {
          rulePriority: 1,
          description: "Delete old image",
          maxImageCount: 2,
          tagStatus: ecr.TagStatus.ANY,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // CodeBuild
    const buildProject = new codebuild.PipelineProject(this, `BuildProject`, {
      projectName: `${resourceName}-code-build`,
      buildSpec: codebuild.BuildSpec.fromSourceFilename("buildspec.yml"),
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
        computeType: codebuild.ComputeType.SMALL,
      },
      environmentVariables: {
        AWS_DEFAULT_REGION: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: this.region,
        },
        AWS_ACCOUNT_ID: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: this.account,
        },
        IMAGE_REPO_NAME: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: ecrRepository.repositoryName,
        },
        IMAGE_TAG: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: "latest",
        },
        LAMBDA_FUNC_NAME: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: process.env.LAMBDA_FUNC_NAME ?? "",
        },
      },
    });

    // CodeBuild role
    buildProject.addToRolePolicy(
      new iam.PolicyStatement({
        resources: [ecrRepository.repositoryArn],
        actions: [
          "ecr:CompleteLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:InitiateLayerUpload",
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
          // Lambda function from a container image
          "ecr:SetRepositoryPolicy",
          "ecr:GetRepositoryPolicy",
        ],
      })
    );
    buildProject.addToRolePolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: ["ecr:GetAuthorizationToken"],
      })
    );
    buildProject.addToRolePolicy(
      new iam.PolicyStatement({
        resources: [
          `arn:aws:lambda:${this.region}:${this.account}:function:lambda-container-sample`,
        ],
        actions: ["lambda:UpdateFunctionCode"],
      })
    );

    // Artifact
    const sourceOutput = new codepipeline.Artifact(`source_artifact`);
    const buildOutput = new codepipeline.Artifact(`build_output`);

    // CodePipeline Actions
    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: "CodeCommit",
      repository: codeRepository,
      branch: "main",
      output: sourceOutput,
    });
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "CodeBuild",
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    // CodePipeline
    new codepipeline.Pipeline(this, "CodePipeline", {
      pipelineName: `${resourceName}-code-pipeline`,
      stages: [
        {
          stageName: "Source",
          actions: [sourceAction],
        },
        {
          stageName: "Build",
          actions: [buildAction],
        },
      ],
    });
  }
}
