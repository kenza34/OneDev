// Backend API Configuration
const API_BASE_URL = `http://${window.location.hostname}:5000/api`;
const GITLAB_BASE_URL = 'https://gitlab.com';
const ONEDEV_GROUP_NAME = 'onedevtechops';
const ONEDEV_GROUP_ID = '110952958';

// Application state
let isAuthenticated = false;
let selectedLanguage = null;
let selectedFramework = null;
let authToken = null;
let currentProjectId = null;
let currentProjectUrl = null;
let currentProjectName = null;
let pipelineGenerated = false;

// DOM Elements
const authBtn = document.getElementById('auth-btn');
const authStatus = document.getElementById('auth-status');
const authCard = document.getElementById('auth-card');

// Section elements
const projectCreationSection = document.getElementById('project-creation-section');
const pipelineSection = document.getElementById('pipeline-section');
const aiAnalysisSection = document.getElementById('ai-analysis-section');

// API Utilities
async function apiCall(endpoint, method = 'GET', data = null) {
    const config = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        }
    };
    
    if (data) {
        config.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'API Error');
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// GitLab Authentication
authBtn.addEventListener('click', async function() {
    const token = document.getElementById('gitlab-token').value;
    
    if (!token) {
        showStatus('error', 'Please enter your GitLab token');
        return;
    }

    authBtn.textContent = 'Connecting...';
    authBtn.disabled = true;

    try {
        const response = await apiCall('/auth/gitlab', 'POST', {
            token: token
        });

        isAuthenticated = true;
        authToken = response.token;
        showStatus('success', `Connection successful - ${response.user.name}`);
        authBtn.textContent = 'Connected';
        
        // Show all sections after authentication
        setTimeout(() => {
            projectCreationSection.classList.add('show');
            pipelineSection.classList.add('show');
            aiAnalysisSection.classList.add('show');
        }, 500);
        
        checkFormCompletion();
        
    } catch (error) {
        showStatus('error', `Authentication error: ${error.message}`);
        authBtn.textContent = 'Connect to GitLab';
        authBtn.disabled = false;
    }
});

// Language selection
const languageCards = document.querySelectorAll('.language-card[data-lang]');
languageCards.forEach(card => {
    card.addEventListener('click', function() {
        if (this.classList.contains('disabled')) return;
        
        languageCards.forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        selectedLanguage = this.dataset.lang;
        
        if (selectedLanguage === 'python') {
            document.getElementById('python-version').classList.add('show');
            document.getElementById('framework-section').style.display = 'block';
        } else {
            document.getElementById('python-version').classList.remove('show');
            document.getElementById('framework-section').style.display = 'none';
        }
        
        checkFormCompletion();
    });
});

// Framework selection
const frameworkCards = document.querySelectorAll('[data-framework]');
frameworkCards.forEach(card => {
    card.addEventListener('click', function() {
        frameworkCards.forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        selectedFramework = this.dataset.framework;
        checkFormCompletion();
    });
});

// Enhanced Deploy Section Event Handlers

// Handle custom deploy checkbox
document.getElementById('custom-deploy-checkbox').addEventListener('change', function() {
    const customInput = document.getElementById('custom-deploy-input');
    if (this.checked) {
        customInput.style.display = 'block';
    } else {
        customInput.style.display = 'none';
        document.getElementById('custom-deploy-description').value = '';
    }
});

// Handle AWS services selection
const awsCheckboxes = ['aws-ec2-checkbox', 'aws-beanstalk-checkbox', 'aws-ecs-checkbox', 'aws-lambda-checkbox'];
const awsConfigNote = document.getElementById('aws-config-note');

awsCheckboxes.forEach(checkboxId => {
    document.getElementById(checkboxId).addEventListener('change', function() {
        // Show AWS config note if any AWS service is selected
        const anyAwsSelected = awsCheckboxes.some(id => document.getElementById(id).checked);
        awsConfigNote.style.display = anyAwsSelected ? 'block' : 'none';
    });
});

// Form completion check
function checkFormCompletion() {
    const projectName = document.getElementById('project-name').value;
    const createBtn = document.getElementById('create-project-btn');
    const generateYmlBtn = document.getElementById('generate-yml-btn');
    
    if (isAuthenticated && projectName && selectedLanguage) {
        createBtn.disabled = false;
    } else {
        createBtn.disabled = true;
    }

    if (currentProjectId && selectedLanguage) {
        generateYmlBtn.disabled = false;
    } else {
        generateYmlBtn.disabled = true;
    }
}

document.getElementById('project-name').addEventListener('input', checkFormCompletion);

// Collect tools configuration with enhanced deploy options
function getSelectedTools() {
    const tools = {};
    const checkboxes = document.querySelectorAll('#pipeline-section input[type="checkbox"]:checked');
    
    checkboxes.forEach(checkbox => {
        const category = checkbox.closest('.tool-card, .deploy-section').querySelector('h4').textContent;
        if (!tools[category]) tools[category] = [];
        tools[category].push(checkbox.value);
    });
    
    // Add custom deployment description if selected
    const customDeployCheckbox = document.getElementById('custom-deploy-checkbox');
    const customDeployDescription = document.getElementById('custom-deploy-description');
    
    if (customDeployCheckbox && customDeployCheckbox.checked) {
        if (!tools['Custom Deployment']) tools['Custom Deployment'] = [];
        if (!tools['Custom Deployment'].includes('custom-deploy')) {
            tools['Custom Deployment'].push('custom-deploy');
        }
        
        // Add the custom description
        if (customDeployDescription && customDeployDescription.value.trim()) {
            tools['Custom Deploy Description'] = [customDeployDescription.value.trim()];
        }
    }
    
    return tools;
}

// CREATE PROJECT
document.getElementById('create-project-btn').addEventListener('click', async function() {
    const projectName = document.getElementById('project-name').value;
    const branchName = document.getElementById('branch-name').value;
    
    currentProjectName = projectName;
    this.textContent = 'Creating...';
    this.disabled = true;
    
    try {
        const response = await apiCall('/projects/create-only', 'POST', {
            name: projectName,
            branch: branchName,
            language: selectedLanguage,
            framework: selectedFramework
        });

        currentProjectId = response.project.id;
        currentProjectUrl = response.project.web_url;
        
        document.getElementById('clone-command').textContent = response.project.clone_url;
        document.getElementById('gitlab-project-link').href = currentProjectUrl;
        document.getElementById('project-info').classList.remove('hidden');
        
        this.textContent = 'Project Created';
        showStatus('success', `Project "${projectName}" created successfully in onedevtechops group!`);
        
        checkFormCompletion();
        
    } catch (error) {
        showStatus('error', `Creation error: ${error.message}`);
        this.textContent = 'Create Project';
        this.disabled = false;
    }
});

// GENERATE YML FILE
document.getElementById('generate-yml-btn').addEventListener('click', async function() {
    const selectedTools = getSelectedTools();
    
    this.textContent = 'Generating...';
    this.disabled = true;
    
    try {
        const response = await apiCall('/projects/generate-yml', 'POST', {
            project_id: currentProjectId,
            name: currentProjectName,
            language: selectedLanguage,
            framework: selectedFramework,
            tools: selectedTools
        });

        document.getElementById('files-generated').classList.remove('hidden');
        
        // Display selected tools
        const toolsListDiv = document.getElementById('tools-list');
        let toolsHtml = '';
        for (const [category, tools] of Object.entries(selectedTools)) {
            if (category !== 'Custom Deploy Description') {
                toolsHtml += `<div style="margin-bottom: 8px;"><strong>${category}:</strong> ${tools.join(', ')}</div>`;
            }
        }
        
        // Add custom deployment description if exists
        if (selectedTools['Custom Deploy Description']) {
            toolsHtml += `<div style="margin-bottom: 8px;"><strong>Custom Deployment:</strong> ${selectedTools['Custom Deploy Description'][0]}</div>`;
        }
        
        toolsListDiv.innerHTML = toolsHtml || '<em>Basic pipeline configuration</em>';
        
        showPipelineStatus('success', `Pipeline configuration with enhanced AWS deployment options and S3 logs integration generated successfully! ${response.message}`);
        
        this.textContent = 'YML Generated';
        document.getElementById('trigger-pipeline-btn').disabled = false;
        document.getElementById('analyze-ai-btn').disabled = false;
        pipelineGenerated = true;
        
    } catch (error) {
        showPipelineStatus('error', `Generation error: ${error.message}`);
        this.textContent = 'Generate .gitlab-ci.yml';
        this.disabled = false;
    }
});

// TRIGGER PIPELINE
document.getElementById('trigger-pipeline-btn').addEventListener('click', async function() {
    if (!pipelineGenerated) {
        showPipelineStatus('error', 'Please generate .gitlab-ci.yml first');
        return;
    }

    this.textContent = 'Triggering...';
    this.disabled = true;
    
    try {
        const response = await apiCall('/projects/trigger-pipeline', 'POST', {
            project_id: currentProjectId
        });

        showPipelineStatus('success', `Pipeline triggered successfully! Pipeline ID: ${response.pipeline.id}. Logs will be uploaded to S3 for AI analysis.`);
        
        this.textContent = 'Pipeline Triggered';
        
    } catch (error) {
        showPipelineStatus('error', `Pipeline trigger error: ${error.message}`);
        this.textContent = 'Trigger Pipeline';
        this.disabled = false;
    }
});

// AI ANALYSIS
document.getElementById('analyze-ai-btn').addEventListener('click', async function() {
    this.textContent = 'Analyzing...';
    this.disabled = true;
    
    try {
        const response = await apiCall(`/ai/analyze/${currentProjectId}`, 'POST', {
            project_name: currentProjectName,
            pipeline_id: 'latest'
        });
        
        updateAIAnalysis(response.analysis);
        document.getElementById('ai-analysis-results').classList.remove('hidden');
        
        this.textContent = 'Analysis Complete';
        showAIStatus('success', 'AI analysis completed successfully using Bedrock Nova Pro!');
        
    } catch (error) {
        showAIStatus('error', `Analysis error: ${error.message}`);
        this.textContent = 'Run AI Analysis';
        this.disabled = false;
    }
});

// Download PDF Report
document.getElementById('download-report-btn').addEventListener('click', async function() {
    try {
        const response = await fetch(`${API_BASE_URL}/reports/pdf/${currentProjectId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `onedev-analysis-report-${currentProjectId}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            throw new Error('Download failed');
        }
    } catch (error) {
        showAIStatus('error', `Download error: ${error.message}`);
    }
});

// Helper functions
function updateAIAnalysis(analysis) {
    const analysisContent = document.getElementById('analysis-content');
    
    const source = analysis.s3_location || 'Pipeline artifacts';
    
    analysisContent.innerHTML = `
        <div style="background: #dbeafe; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <strong>Pipeline ID:</strong> ${analysis.pipeline_id}<br>
            <strong>Stages Analyzed:</strong> ${analysis.stages_analyzed ? analysis.stages_analyzed.join(', ') : 'N/A'}<br>
            <strong>Log Files:</strong> ${analysis.total_log_files || 'N/A'}<br>
            <strong>Tests Executed:</strong> ${analysis.tests_executed}<br>
            <strong>Status:</strong> <span style="color: ${analysis.failures > 0 ? '#ef4444' : '#10b981'};">
                ${analysis.failures} failure(s) detected
            </span><br>
            <strong>S3 Location:</strong> <code style="font-size: 12px; background: #f3f4f6; padding: 2px 4px; border-radius: 4px;">${source}</code><br>
            <strong>Analysis Time:</strong> ${new Date(analysis.analysis_timestamp || Date.now()).toLocaleString()}
        </div>
        
        <h5 style="color: #1e40af; margin: 20px 0 12px;">Professional AI Recommendations:</h5>
        <ul style="color: #374151; line-height: 1.7;">
            ${analysis.suggestions.map(suggestion => 
                `<li><strong>${suggestion.category}:</strong> ${suggestion.recommendation}</li>`
            ).join('')}
        </ul>
    `;
}

function showStatus(type, message) {
    authStatus.className = `status ${type}`;
    authStatus.textContent = message;
    authStatus.classList.remove('hidden');
    
    if (type === 'success') {
        setTimeout(() => authStatus.classList.add('hidden'), 5000);
    }
}

function showPipelineStatus(type, message) {
    const status = document.getElementById('pipeline-status');
    status.className = `status ${type}`;
    status.textContent = message;
    status.classList.remove('hidden');
    
    if (type === 'success') {
        setTimeout(() => status.classList.add('hidden'), 8000);
    }
}

function showAIStatus(type, message) {
    const status = document.getElementById('ai-status');
    status.className = `status ${type}`;
    status.textContent = message;
    status.classList.remove('hidden');
    
    if (type === 'success') {
        setTimeout(() => status.classList.add('hidden'), 5000);
    }
}