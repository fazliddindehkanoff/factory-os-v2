import { asc, count, eq, isNotNull } from "drizzle-orm"

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
  const foreignKeyErrors = await databaseClient.execute("PRAGMA foreign_key_check")

  if (foreignKeyErrors.rows.length) {
    throw new Error(`Database has ${foreignKeyErrors.rows.length} foreign-key integrity error(s)`)
  }

  for (const version of publishedVersions) {
    const steps = await db.select({ order: workflowStepDefinitions.stepOrder })
      .from(workflowStepDefinitions)
      .where(eq(workflowStepDefinitions.versionId, version.id))
      .orderBy(asc(workflowStepDefinitions.stepOrder))

    if (!steps.length || steps.some((step, index) => step.order !== index + 1)) {
      throw new Error(`Published workflow ${version.id} must contain contiguous ordered steps`)
    }
  }

  console.log(
    `Database check passed: ${orderCount} orders, ${departmentCount} supervised departments, ${publishedVersions.length} published workflow(s), no foreign-key errors`,
  )
}

checkDatabase()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    databaseClient.close()
  })
