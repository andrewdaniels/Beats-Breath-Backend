import { MailerGroupsEnums } from "../enums/mailer-groups.enums";

export interface SubscriptionInterface {
  name: string;
  group: MailerGroupsEnums;
}
