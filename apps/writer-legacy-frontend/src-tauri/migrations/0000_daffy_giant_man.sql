CREATE TABLE `character` (
	`id` text(22) PRIMARY KEY NOT NULL,
	`story_id` text(22),
	`is_protagonist` numeric,
	`picture` text(256),
	`name` text,
	`summary` text,
	`age` text,
	FOREIGN KEY (`story_id`) REFERENCES `story`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plotpoint` (
	`id` text(22) PRIMARY KEY NOT NULL,
	`story_id` text(22),
	`name` text,
	`summary` text,
	FOREIGN KEY (`story_id`) REFERENCES `story`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scene` (
	`id` text(22) PRIMARY KEY NOT NULL,
	`scene_json` text,
	FOREIGN KEY (`id`) REFERENCES `treeEntity`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `story` (
	`id` text(22) PRIMARY KEY NOT NULL,
	`name` text(256),
	`author_id` text(22),
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tree` (
	`id` text(22) PRIMARY KEY NOT NULL,
	`story_id` text(22),
	`tree_json` text,
	FOREIGN KEY (`story_id`) REFERENCES `story`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `treeEntity` (
	`id` text(22) PRIMARY KEY NOT NULL,
	`story_id` text(22),
	`parent_id` text(22),
	`title` text,
	`sort_order` integer,
	`kind` text,
	`summary` text,
	FOREIGN KEY (`story_id`) REFERENCES `story`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `treeEntity`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text(22) PRIMARY KEY NOT NULL,
	`provider_id` text(256),
	`nickname` text(256),
	`full_name` text,
	`email` text(256),
	`password` text(256)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_provider_id_unique` ON `user` (`provider_id`);