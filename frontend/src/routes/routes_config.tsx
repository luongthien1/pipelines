import React from "react";
import { HomeOutlined, ShareAltOutlined, HistoryOutlined, CodeOutlined, DatabaseOutlined, RobotOutlined, AppstoreOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import Home from "@/routes/Home";
import PipelineList from "@/routes/PipelineList";
import PipelineEditor from "@/routes/PipelineEditor";
import PipelineRunList from "@/routes/PipelineRunList";
import PipelineRunViewer from "@/routes/PipelineRunViewer";
import TaskManagement from "@/routes/TaskManagement";

import DatasetList from "@/components/DatasetList";
import DatasetDetail from "@/components/DatasetDetail";
import ModelList from "@/components/ModelList";
import ModelDetail from "@/components/ModelDetail";

class NavigationItem {
    id: string;
    title: string;
    icon?: React.ReactNode;
    children?: NavigationItem[];
    path: string;
    element?: React.ReactNode;
    visible: boolean;
    isGroup: boolean;

    constructor(id: string, title: string, path: string, icon?: React.ReactNode, element?: React.ReactNode, children?: NavigationItem[], visible: boolean = true, isGroup: boolean = false) {
        this.id = id;
        this.title = title;
        this.icon = icon;
        this.children = children;
        this.path = path;
        this.element = element;
        this.visible = visible;
        this.isGroup = isGroup;
    }
}

const DatasetDetailWrapper = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    return <DatasetDetail datasetId={Number(id)} onBack={() => navigate('/datasets')} />;
};

const ModelDetailWrapper = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    return <ModelDetail modelId={Number(id)} onBack={() => navigate('/models')} />;
};

const routes_config = [
    new NavigationItem("home-menu", "Home", "/", <HomeOutlined />, <Home/>),
    
    // Node System Parent
    new NavigationItem("node-system-menu", "Node system", "", <AppstoreOutlined />, undefined, [
        new NavigationItem("pipelines-menu", "Pipelines", "/pipelines", <ShareAltOutlined />, <PipelineList />, [
            new NavigationItem("pipeline-editor", "Editor", "/pipelines/:id", undefined, <PipelineEditor />, undefined, false),
        ]),
        new NavigationItem("runs-menu", "Runs", "/runs", <HistoryOutlined />, <PipelineRunList />, [
            new NavigationItem("run-viewer", "Run Viewer", "/runs/:runId", undefined, <PipelineRunViewer />, undefined, false),
        ]),
        new NavigationItem("tasks-menu", "Task Types", "/task-manager", <CodeOutlined />, <TaskManagement />),
    ], true, true),

    // AI Parent
    new NavigationItem("ai-menu", "AI", "", <RobotOutlined />, undefined, [
        new NavigationItem("datasets-menu", "Datasets", "/datasets", <DatabaseOutlined />, <DatasetList />, [
            new NavigationItem("dataset-detail", "Detail", "/datasets/:id", undefined, <DatasetDetailWrapper />, undefined, false),
        ]),
        new NavigationItem("models-menu", "Models", "/models", <RobotOutlined />, <ModelList />, [
            new NavigationItem("model-detail", "Detail", "/models/:id", undefined, <ModelDetailWrapper />, undefined, false),
        ]),
    ], true, true)
]

export { routes_config, NavigationItem }
