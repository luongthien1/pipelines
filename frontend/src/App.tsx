import React, { Component } from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import LayoutApp from "./layout/generalLayout";
import CategoryPage from "./components/CategoryPage";
import { NavigationItem, routes_config } from "./routes/routes_config";
import { AlertProvider } from "./components/Alert/alertContext";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

class App extends Component {


  renderRoutes(routes: NavigationItem[]) {
    return routes.map((route) => {
      if (route.children && route.children.length > 0) {
        const subRoutes = this.renderRoutes(route.children);

        if (route.isGroup) {
          return <React.Fragment key={route.id}>{subRoutes}</React.Fragment>;
        }

        return (
          <Route
            key={route.id}
            path={route.path}
            element={<Outlet />}
          >
            <Route
              index
              element={
                <CategoryPage navigateItems={route} />
              }
            />
            {subRoutes}
          </Route>
        );
      }

      return (
        <Route
          key={route.id}
          path={route.path}
          element={route.element}
        />
      );
    });
  }

  render() {
    return (
      <QueryClientProvider client={queryClient}>
        <AlertProvider>
          <ReactFlowProvider>
            <Routes>
              {/* LayoutApp là khung: sidebar + top + content */}
              <Route path="/" element={<LayoutApp />}>
                {this.renderRoutes(routes_config)}
              </Route>
            </Routes>
          </ReactFlowProvider>
        </AlertProvider>
      </QueryClientProvider>
    );
  }
}

export default App;
