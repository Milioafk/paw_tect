CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`actor` text NOT NULL,
	`object` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_scope` ON `audit` (`scope`,`created`);--> statement-breakpoint
CREATE TABLE `certifications` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`school` text NOT NULL,
	`name` text NOT NULL,
	`contact` text NOT NULL,
	`size` integer NOT NULL,
	`plan` text NOT NULL,
	`state` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket` text NOT NULL,
	`author` text NOT NULL,
	`label` text NOT NULL,
	`body` text NOT NULL,
	`internal` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ticket_events` ON `events` (`ticket`,`created`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket` text NOT NULL,
	`storage_key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ticket_files` ON `files` (`ticket`);--> statement-breakpoint
CREATE TABLE `limits` (
	`id` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`school` text NOT NULL,
	`role` text NOT NULL,
	`alias` text NOT NULL,
	`avatar` text NOT NULL,
	`identity` text NOT NULL,
	`login_key` text,
	`inst_key` text,
	`google_key` text,
	`password` text,
	`must_change` integer DEFAULT 0 NOT NULL,
	`forum_until` integer DEFAULT 0 NOT NULL,
	`strikes` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_login` ON `members` (`scope`,`login_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_email` ON `members` (`scope`,`inst_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_google` ON `members` (`scope`,`google_key`);--> statement-breakpoint
CREATE INDEX `school_role` ON `members` (`scope`,`school`,`role`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`member` text NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`url` text NOT NULL,
	`seen` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `member_notices` ON `notifications` (`member`,`created`);--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`destination` text NOT NULL,
	`state` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pending_mail` ON `outbox` (`scope`,`state`,`created`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`school` text NOT NULL,
	`author` text NOT NULL,
	`parent` text,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text NOT NULL,
	`created` integer NOT NULL,
	`sample_hearts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `post_feed` ON `posts` (`scope`,`school`,`status`,`created`);--> statement-breakpoint
CREATE INDEX `thread_replies` ON `posts` (`parent`,`status`);--> statement-breakpoint
CREATE TABLE `reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`member` text NOT NULL,
	`post` text NOT NULL,
	`kind` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_reaction` ON `reactions` (`member`,`post`,`kind`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`school` text NOT NULL,
	`post` text NOT NULL,
	`reporter` text NOT NULL,
	`reason` text NOT NULL,
	`level` text NOT NULL,
	`state` text NOT NULL,
	`decision` text,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_report` ON `reviews` (`post`,`reporter`);--> statement-breakpoint
CREATE INDEX `review_queue` ON `reviews` (`scope`,`school`,`state`);--> statement-breakpoint
CREATE TABLE `schools` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_domain` ON `schools` (`scope`,`domain`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`member` text NOT NULL,
	`expires` integer NOT NULL,
	`host_user` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`school` text NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`route` text NOT NULL,
	`priority` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`share_identity` integer NOT NULL,
	`family` integer NOT NULL,
	`state` text NOT NULL,
	`assignee` text,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ticket_queue` ON `tickets` (`scope`,`school`,`route`);--> statement-breakpoint
CREATE INDEX `ticket_owner` ON `tickets` (`owner`,`updated`);