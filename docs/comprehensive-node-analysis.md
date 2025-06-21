# n8n Comprehensive Node Analysis

**Generated on:** $(date)
**Total Nodes:** 454 nodes in base package
**Source:** `/packages/nodes-base/dist/types/nodes.json`

## Overview

This document provides a comprehensive analysis of all available n8n nodes, categorized by their function and purpose for the text-to-workflow AI system.

## Node Categories

### 🔗 **Integration Nodes** (External Services)

**Communication & Social:**

- `n8n-nodes-base.slack` - Slack messaging and collaboration
- `n8n-nodes-base.discord` - Discord messaging
- `n8n-nodes-base.microsoftTeams` - Microsoft Teams integration
- `n8n-nodes-base.telegram` - Telegram bot and messaging
- `n8n-nodes-base.whatsApp` - WhatsApp Business API

**Email & Marketing:**

- `n8n-nodes-base.gmail` - Gmail email operations
- `n8n-nodes-base.outlookMail` - Microsoft Outlook mail
- `n8n-nodes-base.mailchimp` - Email marketing automation
- `n8n-nodes-base.sendGrid` - Email delivery service
- `n8n-nodes-base.mailgun` - Email API service

**CRM & Sales:**

- `n8n-nodes-base.salesforce` - Salesforce CRM
- `n8n-nodes-base.hubspot` - HubSpot CRM and marketing
- `n8n-nodes-base.pipedrive` - Pipedrive CRM
- `n8n-nodes-base.activeCampaign` - ActiveCampaign automation
- `n8n-nodes-base.zoho` - Zoho CRM

**Databases & Storage:**

- `n8n-nodes-base.airtable` - Airtable database operations
- `n8n-nodes-base.notion` - Notion workspace management
- `n8n-nodes-base.googleSheets` - Google Sheets operations
- `n8n-nodes-base.microsoftExcel` - Excel file operations
- `n8n-nodes-base.mysql` - MySQL database operations
- `n8n-nodes-base.postgres` - PostgreSQL operations
- `n8n-nodes-base.mongodb` - MongoDB operations

**Cloud Storage:**

- `n8n-nodes-base.googleDrive` - Google Drive file management
- `n8n-nodes-base.dropbox` - Dropbox file operations
- `n8n-nodes-base.oneDrive` - Microsoft OneDrive
- `n8n-nodes-base.aws` - Amazon Web Services
- `n8n-nodes-base.s3` - Amazon S3 storage

**Project Management:**

- `n8n-nodes-base.asana` - Asana project management
- `n8n-nodes-base.trello` - Trello boards and cards
- `n8n-nodes-base.jira` - Atlassian Jira
- `n8n-nodes-base.monday` - Monday.com project management
- `n8n-nodes-base.linear` - Linear issue tracking

**E-commerce:**

- `n8n-nodes-base.shopify` - Shopify store management
- `n8n-nodes-base.wooCommerce` - WooCommerce operations
- `n8n-nodes-base.stripe` - Stripe payment processing
- `n8n-nodes-base.paypal` - PayPal payments

### ⚡ **Trigger Nodes** (Workflow Starters)

**Webhook Triggers:**

- `n8n-nodes-base.webhook` - HTTP webhook receiver
- `n8n-nodes-base.formTrigger` - Form submission trigger
- `n8n-nodes-base.httpRequest` - HTTP request trigger

**Service-Specific Triggers:**

- `n8n-nodes-base.gmailTrigger` - Gmail email received
- `n8n-nodes-base.slackTrigger` - Slack events
- `n8n-nodes-base.airtableTrigger` - Airtable record changes
- `n8n-nodes-base.googleSheetsTrigger` - Google Sheets changes
- `n8n-nodes-base.calendarTrigger` - Calendar events

**Scheduled Triggers:**

- `n8n-nodes-base.cron` - Time-based scheduling
- `n8n-nodes-base.interval` - Regular intervals
- `n8n-nodes-base.scheduleTrigger` - Advanced scheduling

### 🔄 **Transform Nodes** (Data Processing)

**Data Manipulation:**

- `n8n-nodes-base.set` - Set/modify data fields
- `n8n-nodes-base.editFields` - Edit multiple fields
- `n8n-nodes-base.renameFields` - Rename data fields
- `n8n-nodes-base.removeNullValues` - Clean null values
- `n8n-nodes-base.convertToDataUri` - Convert to data URI

**Logic & Control:**

- `n8n-nodes-base.if` - Conditional branching
- `n8n-nodes-base.switch` - Multiple condition routing
- `n8n-nodes-base.merge` - Merge data streams
- `n8n-nodes-base.split` - Split data into multiple streams
- `n8n-nodes-base.noOp` - No operation (passthrough)

**Code Execution:**

- `n8n-nodes-base.function` - Custom JavaScript code
- `n8n-nodes-base.functionItem` - JavaScript per item
- `n8n-nodes-base.code` - Multi-language code execution
- `n8n-nodes-base.pythonFunction` - Python code execution

**Data Analysis:**

- `n8n-nodes-base.aggregate` - Data aggregation
- `n8n-nodes-base.sort` - Sort data
- `n8n-nodes-base.limit` - Limit number of items
- `n8n-nodes-base.removeDuplicates` - Remove duplicate data
- `n8n-nodes-base.summarize` - Data summarization

### 🛠️ **Utility Nodes**

**HTTP & API:**

- `n8n-nodes-base.httpRequest` - Generic HTTP requests
- `n8n-nodes-base.respondToWebhook` - Send webhook responses
- `n8n-nodes-base.apiTemplateIo` - API template generation

**File Operations:**

- `n8n-nodes-base.readBinaryFile` - Read files
- `n8n-nodes-base.writeBinaryFile` - Write files
- `n8n-nodes-base.compress` - File compression
- `n8n-nodes-base.extractFromFile` - Extract file contents

**Date & Time:**

- `n8n-nodes-base.dateTime` - Date/time manipulation
- `n8n-nodes-base.wait` - Add delays
- `n8n-nodes-base.scheduleTrigger` - Schedule workflows

**Text Processing:**

- `n8n-nodes-base.html` - HTML parsing/generation
- `n8n-nodes-base.xml` - XML processing
- `n8n-nodes-base.markdown` - Markdown conversion
- `n8n-nodes-base.regex` - Regular expressions

**Notifications:**

- `n8n-nodes-base.pushover` - Push notifications
- `n8n-nodes-base.pushbullet` - Cross-device notifications
- `n8n-nodes-base.sms` - SMS messaging

### 🤖 **AI & ML Nodes**

**OpenAI Integration:**

- `n8n-nodes-base.openAI` - OpenAI GPT and other models
- `n8n-nodes-base.openAIAssistant` - OpenAI Assistants API

**Language Processing:**

- `n8n-nodes-base.microsoftLuis` - Language understanding
- `n8n-nodes-base.googleTranslate` - Translation services
- `n8n-nodes-base.awsTextract` - Text extraction from images

### 📊 **Analytics & Monitoring**

**Analytics:**

- `n8n-nodes-base.googleAnalytics` - Google Analytics data
- `n8n-nodes-base.mixpanel` - Event tracking
- `n8n-nodes-base.segment` - Customer data platform

**Monitoring:**

- `n8n-nodes-base.uptimeRobot` - Website monitoring
- `n8n-nodes-base.pingdom` - Performance monitoring
- `n8n-nodes-base.errorReporting` - Error tracking

## Common Usage Patterns for Text-to-Workflow

### 1. **Data Integration Patterns**

```
Trigger → Transform → Action
Example: "When Airtable record is created, format data and send Slack message"
```

### 2. **Notification Patterns**

```
Trigger → Logic → Notification
Example: "When form is submitted, if priority is high, send email alert"
```

### 3. **Data Synchronization**

```
Trigger → Transform → Multiple Actions
Example: "When CRM contact is updated, sync to email list and Google Sheets"
```

### 4. **Automated Responses**

```
Webhook → Process → Respond
Example: "Receive webhook, process payment, send confirmation"
```

## Node Selection Strategy for AI

When the AI system receives a natural language prompt, it should:

1. **Identify Intent**: What action does the user want to perform?
2. **Map Services**: Which services/platforms are mentioned?
3. **Determine Flow**: Is this a trigger, action, or transform operation?
4. **Select Nodes**: Choose the most appropriate node(s) from this catalog

### High-Priority Nodes for Common Requests

**Most Frequently Used:**

- HTTP Request (generic API calls)
- Set (data manipulation)
- If (conditional logic)
- Webhook (receiving data)
- Slack (notifications)
- Gmail (email operations)
- Google Sheets (data storage)
- Airtable (database operations)

**AI-Friendly Patterns:**

- Natural language → Code nodes for complex logic
- Service names → Direct integration nodes
- "When X happens" → Trigger nodes
- "Send/Create/Update" → Action nodes
- "If/When/Check" → Logic nodes

This comprehensive catalog enables the AI system to accurately map natural language requests to specific n8n nodes and generate functional workflows.
