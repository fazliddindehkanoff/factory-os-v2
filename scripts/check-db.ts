import { asc, count, isNotNull } from "drizzle-orm"

import { databaseClient, db } from "../src/db/client"
import {
  departments,
  orders,
  workflowStepDefinitions,
  workflowTemplateVersions,
} from "../src/db/schema"

async function checkDatabase() {
  const [{ orderCount }] = await db.select({ orderCount: count() }).from(orders)
  const [{ departmentCount }] = await db.select({ departmentCount: count() })
    .from(departments)
    .where(isNotNull(departments.supervisorUserId))
  const publishedVersions = await db.select({ id: workflowTemplateVersions.id })
    .from(workflowTemplateVersions)
    .where(isNotNull(workflowTemplateVersions.publishedAt))
  const steps = await db.select({ order: workflowStepDefinitions.stepOrder })
    .from(workflowStepDefinitions)
    .orderBy(asc(workflowStepDefinitions.stepOrder))

  if (orderCount !== 3) throw new Error(`Expected 3 seeded orders, found ${orderCount}`)
  if (departmentCount !== 2) throw new Error(`Expected 2 departments with supervisors, found ${departmentCount}`)
  if (publishedVersions.length !== 1) throw new Error(`Expected 1 published workflow, found ${publishedVersions.length}`)
  if (steps.length !== 7 || steps.some((step, index) => step.order !== index + 1)) {
    throw new Error("The default workflow must contain seven ordered steps")
  }

  console.log("Database check passed: 3 orders, 2 supervised departments, 1 published workflow, 7 ordered steps")
}

checkDatabase()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    databaseClient.close()
  })
