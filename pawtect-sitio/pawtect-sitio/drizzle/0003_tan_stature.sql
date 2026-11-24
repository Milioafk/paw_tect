CREATE TABLE `roster` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`school` text NOT NULL,
	`dni_key` text NOT NULL,
	`inst_key` text NOT NULL,
	`identity` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roster_dni` ON `roster` (`scope`,`dni_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `roster_email` ON `roster` (`scope`,`inst_key`);--> statement-breakpoint
CREATE INDEX `roster_school` ON `roster` (`scope`,`school`);