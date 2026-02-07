import {
    PdfExportNotCompletedError,
    PdfExportTaskNotFoundError
} from "../../api/generated/api/resources/pdfExport/errors";
import { PdfExportService } from "../../api/generated/api/resources/pdfExport/service/PdfExportService";
import type { FdrApplication } from "../../app";

export function getPdfExportController(app: FdrApplication): PdfExportService {
    return new PdfExportService({
        createTask: async (req, res) => {
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: req.headers.authorization,
                orgId: req.body.orgId
            });
            const task = await app.services.pdfExport.createTask({
                orgId: req.body.orgId,
                docsUrl: req.body.docsUrl,
                options: req.body.options
            });
            return res.send(task);
        },

        getTask: async (req, res) => {
            const task = await app.services.pdfExport.getTask(req.params.taskId);
            if (task == null) {
                throw new PdfExportTaskNotFoundError();
            }
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: req.headers.authorization,
                orgId: task.orgId
            });
            return res.send(task);
        },

        listTasks: async (req, res) => {
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: req.headers.authorization,
                orgId: req.query.orgId
            });
            const tasks = await app.services.pdfExport.listTasks(req.query.orgId, req.query.docsUrl, req.query.limit);
            return res.send({ tasks });
        },

        updateTask: async (req, res) => {
            await app.services.pdfExport.verifyDocsPdfExporterLambdaToken(req.headers.authorization);
            const task = await app.services.pdfExport.getTask(req.params.taskId);
            if (task == null) {
                throw new PdfExportTaskNotFoundError();
            }
            const updatedTask = await app.services.pdfExport.updateTaskStatus(req.params.taskId, req.body);
            return res.send(updatedTask);
        },

        getDownloadUrl: async (req, res) => {
            const task = await app.services.pdfExport.getTask(req.params.taskId);
            if (task == null) {
                throw new PdfExportTaskNotFoundError();
            }
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: req.headers.authorization,
                orgId: task.orgId
            });
            if (task.status !== "COMPLETED") {
                throw new PdfExportNotCompletedError();
            }
            const downloadResponse = await app.services.pdfExport.getDownloadUrl(req.params.taskId);
            return res.send(downloadResponse);
        }
    });
}
