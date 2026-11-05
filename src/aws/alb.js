import { ElasticLoadBalancingV2Client, DescribeTargetHealthCommand } from '@aws-sdk/client-elastic-load-balancing-v2';

export async function checkAlbHealth(targetGroupArn, region = process.env.AWS_REGION || 'us-east-1') {
  if (!targetGroupArn) {
    throw new Error('AWS_ALB_TARGET_GROUP_ARN is required for live AWS ALB health checks.');
  }

  const client = new ElasticLoadBalancingV2Client({ region });
  const command = new DescribeTargetHealthCommand({ TargetGroupArn: targetGroupArn });

  try {
    const response = await client.send(command);
    const targetHealthDescriptions = response.TargetHealthDescriptions || [];

    const unhealthyTargets = targetHealthDescriptions.filter(
      t => t.TargetHealth && t.TargetHealth.State !== 'healthy'
    );

    const isHealthy = targetHealthDescriptions.length > 0 && unhealthyTargets.length === 0;

    return {
      status: isHealthy ? 'HEALTHY' : 'UNHEALTHY',
      targetGroupArn,
      totalTargets: targetHealthDescriptions.length,
      unhealthyCount: unhealthyTargets.length,
      targets: targetHealthDescriptions.map(t => ({
        id: t.Target?.Id,
        port: t.Target?.Port,
        state: t.TargetHealth?.State,
        reason: t.TargetHealth?.Reason || null,
        description: t.TargetHealth?.Description || null
      }))
    };
  } catch (err) {
    throw new Error(`AWS ALB DescribeTargetHealth failed: ${err.message}`);
  }
}
