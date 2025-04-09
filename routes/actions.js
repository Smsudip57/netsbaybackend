const axios = require("axios");
const { time } = require("console");
require("dotenv").config();

// const PROXMOX_API_URL = process.env.PROXMOX_API_URL; // e.g., "https://your-proxmox-server:8006/api2/json"
// const PROXMOX_TOKEN_ID = process.env.PROXMOX_TOKEN_ID;
// const PROXMOX_TOKEN_SECRET = process.env.PROXMOX_TOKEN_SECRET;
const PROXMOX_API_URL = "https://pve.technoconnect.io:8006/api2/json";
const PROXMOX_TOKEN_ID = "root@pam!NetbayTokenVer1";

const PROXMOX_TOKEN_SECRET = "d48a895d-e8b0-4b42-8188-613c39d29563";

const proxmoxAPI = axios.create({
  baseURL: PROXMOX_API_URL,
  headers: {
    Authorization: `PVEAPIToken=${PROXMOX_TOKEN_ID}=${PROXMOX_TOKEN_SECRET}`,
    "Content-Type": "application/json",
  },
  httpsAgent: new (require("https").Agent)({ rejectUnauthorized: false }),
});

async function getVM(vmid) {
  try {
    const response = await proxmoxAPI.get(`/cluster/resources?type=vm`);
    const vm = response.data.data.find((vm) => vm.vmid == vmid);
    return vm ? vm : null;
  } catch (error) {
    console.error(`Error fetching VM ${vmid}:`, error);
    return null;
  }
}

async function getVMNode(vmid) {
  const vm = await getVM(vmid);
  if (!vm) throw new Error(`VM ${vmid} not found`);
  return vm.node;
}

async function executeVMAction(vmid, action) {
  try {
    const node = await getVMNode(vmid);
    const response = await proxmoxAPI.post(
      `/nodes/${node}/qemu/${vmid}/status/${action}`,
      {}
    );
    return response.data;
  } catch (error) {
    console.error(`Failed to ${action} VM ${vmid}:`, error);
    throw new Error(`Failed to ${action} VM ${vmid}`);
  }
}

async function startVM(vmid) {
  return executeVMAction(vmid, "start");
}

async function stopVM(vmid) {
  return executeVMAction(vmid, "stop");
}

async function restartVM(vmid) {
  return executeVMAction(vmid, "reboot");
}

async function changeCloudInitPassword(vmid, password) {
  try {
    await executeVMAction(vmid, "stop");
    const node = await getVMNode(vmid);
    const response = await proxmoxAPI.put(
      `/nodes/${node}/qemu/${vmid}/config`,
      {
        ciuser: "root",
        cipassword: password,
      }
    );
    await executeVMAction(vmid, "start");
    return response?.data?.data ? response?.data : true;
  } catch (error) {
    console.log(error);
    console.error(`Failed to change password for VM ${vmid}:`, error);
    throw new Error(`Failed to change password for VM ${vmid}`);
  }
}

async function changeWindowsVMPassword(vmid, username, password) {
  try {
    const node = await getVMNode(vmid);
    const response = await proxmoxAPI.post(
      `/nodes/${node}/qemu/${vmid}/agent/set-user-password`,
      {
        username: username,
        password: password,
        crypted: 0,
      }
    );

    return response.data ? response?.data : true;
  } catch (error) {
    throw new Error(
      `Failed to change Windows VM password for ${username} on VM ${vmid}`
    );
  }
}

async function getVMStatus(vmid) {
  try {
    const node = await getVMNode(vmid);
    const response = await proxmoxAPI.get(
      `/nodes/${node}/qemu/${vmid}/status/current`
    );
    return response.data.data;
  } catch (error) {
    console.error(`Failed to get status for VM ${vmid}:`, error);
    throw new Error(`Failed to get status for VM ${vmid}`);
  }
}

async function getVMResourceUsage(vmid) {
  try {
    const node = await getVMNode(vmid);
    const response = await proxmoxAPI.get(
      `/nodes/${node}/qemu/${vmid}/rrddata?timeframe=hour`
    );
    const data = response.data.data.pop();
    return {
      cpuUsage: (data.cpu * 100).toFixed(2) + "%",
      memoryUsage: ((data.mem / data.maxmem) * 100).toFixed(2) + "%",
      storageUsage: ((data.disk / data.maxdisk) * 100).toFixed(2) + "%",
      networkUsage:
        ((Math.max(data.netin, data.netout) / 1e9) * 100).toFixed(2) + "%",
    };
  } catch (error) {
    console.error(`Failed to get resource usage for VM ${vmid}:`, error);
    throw new Error(`Failed to get resource usage for VM ${vmid}`);
  }
}

/// External

const createApiClient = (ipAddress, hashedCode) => {
  const baseURL = `http://${ipAddress}:11500`;
  return axios.create({
    baseURL,
    headers: {
      Authorization: hashedCode,
      "Content-Type": "application/json",
    },
    timeout: 5000,
  });
};

const handleError = (error) => {
  if (error.code === "ECONNRESET") {
    return true;
  } else if (error.response) {
    throw new Error(
      `API Error: ${error.response.status} - ${JSON.stringify(
        error.response.data
      )}`
    );
  } else if (error.request) {
    throw new Error("No response received from the API server");
  } else {
    throw new Error(`Request Error: ${error.message}`);
  }
};

const fetchSpecs = async (ipAddress, hashedCode) => {
  try {
    const client = createApiClient(ipAddress, hashedCode);
    const response = await client.get("/fetch_specs");
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

const fetchUsage = async (ipAddress, hashedCode) => {
  try {
    const client = createApiClient(ipAddress, hashedCode);
    const response = await client.get("/fetch_usage");
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

const changePassword = async (ipAddress, hashedCode, username, password) => {
  try {
    const client = createApiClient(ipAddress, hashedCode);
    const response = await client.post("/change_password", {
      username,
      password,
    });
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

const rebootServer = async (ipAddress, hashedCode) => {
  try {
    const client = createApiClient(ipAddress, hashedCode);
    const response = await client.post("/reboot");

    return response.data;
  } catch (error) {
    handleError(error);
  }
};

async function getExternalVMResourceUsage(ipAddress, hashedCode) {
  try {
    const [usageData, specsData] = await Promise.all([
      fetchUsage(ipAddress, hashedCode),
      fetchSpecs(ipAddress, hashedCode),
    ]);

    let networkPercentage = "N/A";
    if (specsData && specsData.network && specsData.network.max_bandwidth) {
      const maxBandwidth = parseFloat(specsData.network.max_bandwidth);
      const currentUsage = Math.max(
        parseFloat(usageData.network_in.replace(/[^\d.-]/g, "")),
        parseFloat(usageData.network_out.replace(/[^\d.-]/g, ""))
      );

      if (!isNaN(maxBandwidth) && !isNaN(currentUsage) && maxBandwidth > 0) {
        networkPercentage =
          ((currentUsage / maxBandwidth) * 100).toFixed(2) + "%";
      }
    }

    let storagePercentage = "N/A";
    if (specsData && specsData.storage && specsData.storage.total) {
      const totalStorage = parseFloat(
        specsData.storage.total.replace(/[^\d.-]/g, "")
      );
      const usedStorage = parseFloat(
        specsData.storage.used.replace(/[^\d.-]/g, "")
      );

      if (!isNaN(totalStorage) && !isNaN(usedStorage) && totalStorage > 0) {
        storagePercentage =
          ((usedStorage / totalStorage) * 100).toFixed(2) + "%";
      }
    }

    return {
      cpuUsage: usageData.cpu_percentage.toFixed(2) + "%",
      memoryUsage: usageData.ram_percentage.toFixed(2) + "%",
      storageUsage: storagePercentage,
      networkUsage: networkPercentage,
      // Additional details that might be useful
      // memoryDetails: usageData.used_ram,
      // networkIn: usageData.network_in,
      // networkOut: usageData.network_out,
      // diskRead: usageData.disk_read,
      // diskWrite: usageData.disk_write
    };
  } catch (error) {
    console.error(
      `Failed to get resource usage for external VM at ${ipAddress}:`,
      error
    );
    throw new Error(
      `Failed to get resource usage for external VM at ${ipAddress}: ${error.message}`
    );
  }
}

module.exports = {
  startVM,
  stopVM,
  restartVM,
  changeCloudInitPassword,
  changeWindowsVMPassword,
  getVMStatus,
  getVMResourceUsage,
  executeVMAction,
  //enternal
  fetchSpecs,
  fetchUsage,
  changePassword,
  rebootServer,
  getExternalVMResourceUsage,
};
