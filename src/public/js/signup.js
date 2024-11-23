document.addEventListener('DOMContentLoaded', () => {
    // Pre-fill form with suggested values from URL parameters
    const params = new URLSearchParams(window.location.search);
    
    if (params.get('name')) {
        document.getElementById('realName').value = params.get('name');
    }
    if (params.get('email')) {
        document.getElementById('emailAddress').value = params.get('email');
    }
});

document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        realName: document.getElementById('realName').value,
        emailAddress: document.getElementById('emailAddress').value,
        authType: new URLSearchParams(window.location.search).get('authType'),
        authId: new URLSearchParams(window.location.search).get('authId')
    };

    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Signup failed');
        }

        window.location.href = '/';
    } catch (error) {
        alert('Error creating account: ' + error.message);
    }
}); 