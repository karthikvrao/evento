# Evento Agent Service: GCP Deployment Checklist

Before the GitHub Actions CI/CD pipeline runs, you must complete these manual Google Cloud infrastructure steps. 
**If you have already configured a Firebase project for this, these steps should be done inside that same Google Cloud Project.**

## 1. Enable Required APIs
Ensure the following APIs are enabled in your Google Cloud Console (`APIs & Services` > `Library`):
- [ ] **Cloud Run API**
- [ ] **Vertex AI API** (Required for Agent Engine Sessions and Veo)
- [ ] **Firestore API** (Running in Native Mode, required for storing session metadata)
- [ ] **Cloud Storage API**
- [ ] **Cloud Build API** (Required for source-based deployments)
- [ ] **Artifact Registry API** (Required to store the Cloud Run container image)
- [ ] **Secret Manager API** (Optional, but recommended for storing sensitive API keys)

## 2. Generate a Service Account for Cloud Run
Cloud Run instances need a Service Account to interact with other GCP services.

1. Go to `IAM & Admin` > `Service Accounts`
2. Create a new service account named `evento-agent-sa`.
3. Grant it the following roles:
   - [ ] **Vertex AI User** (`roles/aiplatform.user`) - Allows invoking Vertex AI models and Agent Engine sessions.
   - [ ] **Cloud Datastore User** (`roles/datastore.user`) - Allows read/write access to Firestore.
   - [ ] **Storage Object Admin** (`roles/storage.objectAdmin`) - Allows reading/writing to the GCS media bucket.
4. Click Done.

## 3. Create GCS Media Bucket
1. Go to `Cloud Storage` > `Buckets`
2. Click **Create**
3. Name your bucket (e.g., `evento-media-assets-[YOUR-PROJECT-ID]`). **Note this name down.**
4. Choose the same region you plan to deploy Cloud Run to (e.g., `us-central1`).
5. Ensure `Enforce public access prevention on this bucket` is **UNCHECKED** if you want the generated images to be publicly accessible to users.
6. Create the bucket.

## 4. Setup GitHub Actions Secrets
To allow GitHub Actions to deploy to Cloud Run automatically, you must generate a JSON key for an administrative Service Account and add it to your GitHub Repository Secrets.

1. Go to `IAM & Admin` > `Service Accounts`.
2. Locate your **Compute Engine default service account** or create a new `github-actions-deployer` service account.
3. Ensure the deployer account has these roles:
   - [ ] **Cloud Run Admin** (`roles/run.admin`)
   - [ ] **Service Account User** (`roles/iam.serviceAccountUser`)
   - [ ] **Artifact Registry Administrator** (`roles/artifactregistry.admin`)
   - [ ] **Cloud Build Editor** (`roles/cloudbuild.builds.editor`)
   - [ ] **Storage Admin** (`roles/storage.admin`)
4. Go to the `Keys` tab for this service account > `Add Key` > `Create new key` > **JSON**.
5. Save the downloaded file.
6. Go to your GitHub Repository Settings > `Secrets and variables` > `Actions`.
7. Add a *New repository secret*:
   - Name: `GCP_PROJECT_ID`
   - Value: `[your-gcp-project-id]`
8. Add another *New repository secret*:
   - Name: `GCP_SA_KEY`
   - Value: `[paste the exact entire contents of the JSON key file]`

## 5. Add Application Environment Variables
Once the CI/CD pipeline deploys for the first time, you must manually go into the Cloud Run Console to add the application secrets.

1. Go to `Cloud Run` > Select the `evento-agent-service` > `Edit & Deploy New Revision` > `Variables & Secrets`.
2. Add the following required Environment Variables:
   - [ ] `SESSION_SERVICE` = `vertexai`
   - [ ] `GOOGLE_CLOUD_PROJECT` = `[your-gcp-project-id]`
   - [ ] `GOOGLE_CLOUD_LOCATION` = `us-central1`
   - [ ] `FIREBASE_PROJECT_ID` = `[your-firebase-project-id]` (often the same as the GCP project id)
   - [ ] `GCS_BUCKET_NAME` = `[the name of the bucket you created in Step 3]`

*(Optional) If you prefer to use Secret Manager for production rather than plain Environment Variables:*
1. Go to **Secret Manager** and create a secret for `FIREBASE_PROJECT_ID` or any other sensitive keys.
2. Grant the `evento-agent-sa` service account the **Secret Manager Secret Accessor** (`roles/secretmanager.secretAccessor`) role.
3. In Cloud Run > `Variables & Secrets`, reference the secret directly.
3. Deploy the new revision.

Once all these steps are complete, the CI/CD pipeline defined in [.github/workflows/deploy.yml](file:///Volumes/Jaaga1/repos/evento/.github/workflows/deploy.yml) will be able to automatically deploy updates to both the Vite Frontend and the FastAPI Backend on every push to the `main` branch.
