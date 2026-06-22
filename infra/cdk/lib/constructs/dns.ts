import * as route53 from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

export interface DnsProps {
  readonly zoneName: string;
  readonly appHost: string;
  readonly apiHost: string;
  readonly ip: string;
}

// app./api. A-records in the existing hosted zone → the Elastic IP. Zone is in
// the same account (fromLookup). Records are CDK-managed → removed on destroy.
export class Dns extends Construct {
  constructor(scope: Construct, id: string, props: DnsProps) {
    super(scope, id);

    const zone = route53.HostedZone.fromLookup(this, "Zone", {
      domainName: props.zoneName,
    });
    const target = route53.RecordTarget.fromIpAddresses(props.ip);

    new route53.ARecord(this, "AppA", {
      zone,
      recordName: props.appHost,
      target,
    });
    new route53.ARecord(this, "ApiA", {
      zone,
      recordName: props.apiHost,
      target,
    });
  }
}
