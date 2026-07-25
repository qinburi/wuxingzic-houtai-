import { Module } from "@nestjs/common";
import { AuthGuard } from "./auth.js";
import {
  AssetsController,
  AuthController,
  DashboardController,
  DalingWebhookController,
  DisplayConfigController,
  FilesController,
  HealthController,
  IntegrationsController,
  IpAssetsController,
  LogsController,
  OrganizationController,
  SystemManagementController,
  PortalController,
  WorkflowController
} from "./controllers.js";
import { PersistenceService } from "./persistence.service.js";
import { StateService } from "./state.service.js";
import { StorageService } from "./storage.service.js";

@Module({
  controllers: [AuthController, DashboardController, AssetsController, IpAssetsController, WorkflowController, DisplayConfigController, OrganizationController, DalingWebhookController, IntegrationsController, LogsController, PortalController, FilesController, SystemManagementController, HealthController],
  providers: [PersistenceService, StateService, StorageService, AuthGuard]
})
export class AppModule {}
