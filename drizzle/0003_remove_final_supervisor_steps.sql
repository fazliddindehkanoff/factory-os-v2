UPDATE `workflow_actions`
SET `from_step_instance_id` = NULL
WHERE `from_step_instance_id` IN (
  SELECT `id` FROM `workflow_step_instances`
  WHERE `step_definition_id` IN (
    'workflow-step-procurement-supervisor',
    'workflow-step-warehouse-supervisor'
  )
);--> statement-breakpoint
UPDATE `workflow_actions`
SET `to_step_instance_id` = NULL
WHERE `to_step_instance_id` IN (
  SELECT `id` FROM `workflow_step_instances`
  WHERE `step_definition_id` IN (
    'workflow-step-procurement-supervisor',
    'workflow-step-warehouse-supervisor'
  )
);--> statement-breakpoint
DELETE FROM `workflow_step_instances`
WHERE `step_definition_id` IN (
  'workflow-step-procurement-supervisor',
  'workflow-step-warehouse-supervisor'
);--> statement-breakpoint
UPDATE `workflow_step_instances`
SET `step_order` = 9
WHERE `step_definition_id` = 'workflow-step-warehouse-receipt';--> statement-breakpoint
UPDATE `workflow_instances`
SET `current_step_order` = 9,
    `updated_at` = CURRENT_TIMESTAMP
WHERE `current_step_order` IN (9, 10);--> statement-breakpoint
UPDATE `workflow_instances`
SET `current_step_order` = NULL,
    `status` = 'approved',
    `completed_at` = COALESCE(`completed_at`, CURRENT_TIMESTAMP),
    `updated_at` = CURRENT_TIMESTAMP
WHERE `current_step_order` = 11;--> statement-breakpoint
DELETE FROM `workflow_step_definitions`
WHERE `id` = 'workflow-step-procurement-supervisor';--> statement-breakpoint
UPDATE `workflow_step_definitions`
SET `step_order` = 9
WHERE `id` = 'workflow-step-warehouse-receipt';--> statement-breakpoint
DELETE FROM `workflow_step_definitions`
WHERE `id` = 'workflow-step-warehouse-supervisor';
