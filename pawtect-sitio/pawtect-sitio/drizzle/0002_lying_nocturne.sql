ALTER TABLE `certifications` ADD `requester` text;--> statement-breakpoint
ALTER TABLE `certifications` ADD `status_key` text;--> statement-breakpoint
ALTER TABLE `certifications` ADD `issued_at` integer DEFAULT 0 NOT NULL;