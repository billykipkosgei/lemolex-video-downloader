#!/bin/bash

# Lemolex Video Downloader API - cURL Examples
# Command line examples for testing the API
# Author: Billy

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Configuration
API_BASE="http://localhost:3001/api"
SAMPLE_URL="https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Helper function for colored output
print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Helper function to check if API is running
check_api() {
    if ! curl -s "$API_BASE/health" > /dev/null 2>&1; then
        print_error "API server is not running!"
        print_info "Please start the server with: npm start"
        exit 1
    fi
}

# Example 1: Health Check
example_health_check() {
    print_header "Health Check"
    
    echo "GET $API_BASE/health"
    curl -s -X GET "$API_BASE/health" | jq '.' || curl -s -X GET "$API_BASE/health"
    echo -e "\n"
}

# Example 2: API Documentation
example_get_docs() {
    print_header "Get API Documentation"
    
    echo "GET $API_BASE/docs"
    curl -s -X GET "$API_BASE/docs" | jq '.' || curl -s -X GET "$API_BASE/docs"
    echo -e "\n"
}

# Example 3: Get Video Information
example_get_video_info() {
    print_header "Get Video Information"
    
    echo "POST $API_BASE/info"
    echo "Body: {\"url\":\"$SAMPLE_URL\"}"
    
    curl -s -X POST "$API_BASE/info" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$SAMPLE_URL\"}" | jq '.' || \
    curl -s -X POST "$API_BASE/info" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$SAMPLE_URL\"}"
    echo -e "\n"
}

# Example 4: Start Video+Audio Download
example_download_video_audio() {
    print_header "Download Video+Audio"
    
    echo "POST $API_BASE/download"
    echo "Body: {\"url\":\"$SAMPLE_URL\",\"format\":\"video+audio\",\"quality\":\"best\"}"
    
    RESPONSE=$(curl -s -X POST "$API_BASE/download" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$SAMPLE_URL\",\"format\":\"video+audio\",\"quality\":\"best\"}")
    
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    
    # Extract download ID for status checking
    DOWNLOAD_ID=$(echo "$RESPONSE" | jq -r '.data.id' 2>/dev/null)
    
    if [ "$DOWNLOAD_ID" != "null" ] && [ "$DOWNLOAD_ID" != "" ]; then
        print_success "Download started with ID: $DOWNLOAD_ID"
        echo "export DOWNLOAD_ID='$DOWNLOAD_ID'" > /tmp/lemolex_download_id.sh
    fi
    echo -e "\n"
}

# Example 5: Start Audio-Only Download
example_download_audio_only() {
    print_header "Download Audio Only (MP3)"
    
    echo "POST $API_BASE/download"
    echo "Body: {\"url\":\"$SAMPLE_URL\",\"format\":\"audio-only\",\"quality\":\"best\"}"
    
    RESPONSE=$(curl -s -X POST "$API_BASE/download" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$SAMPLE_URL\",\"format\":\"audio-only\",\"quality\":\"best\"}")
    
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    
    # Extract download ID
    DOWNLOAD_ID=$(echo "$RESPONSE" | jq -r '.data.id' 2>/dev/null)
    
    if [ "$DOWNLOAD_ID" != "null" ] && [ "$DOWNLOAD_ID" != "" ]; then
        print_success "Audio download started with ID: $DOWNLOAD_ID"
        echo "export AUDIO_DOWNLOAD_ID='$DOWNLOAD_ID'" >> /tmp/lemolex_download_id.sh
    fi
    echo -e "\n"
}

# Example 6: Check Download Status
example_check_download_status() {
    print_header "Check Download Status"
    
    # Try to load download ID from previous examples
    if [ -f /tmp/lemolex_download_id.sh ]; then
        source /tmp/lemolex_download_id.sh
    fi
    
    if [ -z "$DOWNLOAD_ID" ]; then
        print_info "No download ID available. Run a download example first."
        print_info "You can also manually set: export DOWNLOAD_ID='your-download-id'"
        echo -e "\n"
        return
    fi
    
    echo "GET $API_BASE/download/$DOWNLOAD_ID"
    curl -s -X GET "$API_BASE/download/$DOWNLOAD_ID" | jq '.' || \
    curl -s -X GET "$API_BASE/download/$DOWNLOAD_ID"
    echo -e "\n"
}

# Example 7: Get All Downloads
example_get_all_downloads() {
    print_header "Get All Downloads"
    
    echo "GET $API_BASE/downloads"
    curl -s -X GET "$API_BASE/downloads" | jq '.' || \
    curl -s -X GET "$API_BASE/downloads"
    echo -e "\n"
}

# Example 8: Get Downloads by Status
example_get_downloads_by_status() {
    print_header "Get Downloads by Status"
    
    echo "GET $API_BASE/downloads?status=completed&limit=10"
    curl -s -X GET "$API_BASE/downloads?status=completed&limit=10" | jq '.' || \
    curl -s -X GET "$API_BASE/downloads?status=completed&limit=10"
    echo -e "\n"
}

# Example 9: Get Statistics
example_get_stats() {
    print_header "Get Download Statistics"
    
    echo "GET $API_BASE/stats"
    curl -s -X GET "$API_BASE/stats" | jq '.' || \
    curl -s -X GET "$API_BASE/stats"
    echo -e "\n"
}

# Example 10: Clear Completed Downloads
example_clear_completed() {
    print_header "Clear Completed Downloads"
    
    echo "DELETE $API_BASE/downloads/completed"
    curl -s -X DELETE "$API_BASE/downloads/completed" | jq '.' || \
    curl -s -X DELETE "$API_BASE/downloads/completed"
    echo -e "\n"
}

# Example 11: Cancel Download
example_cancel_download() {
    print_header "Cancel Download"
    
    # Try to load download ID from previous examples
    if [ -f /tmp/lemolex_download_id.sh ]; then
        source /tmp/lemolex_download_id.sh
    fi
    
    if [ -z "$DOWNLOAD_ID" ]; then
        print_info "No download ID available for cancellation."
        print_info "You can manually cancel with: curl -X DELETE $API_BASE/download/YOUR_DOWNLOAD_ID"
        echo -e "\n"
        return
    fi
    
    echo "DELETE $API_BASE/download/$DOWNLOAD_ID"
    curl -s -X DELETE "$API_BASE/download/$DOWNLOAD_ID" | jq '.' || \
    curl -s -X DELETE "$API_BASE/download/$DOWNLOAD_ID"
    echo -e "\n"
}

# Example 12: Custom Download with All Options
example_custom_download() {
    print_header "Custom Download with All Options"
    
    echo "POST $API_BASE/download"
    echo "Body: Full options example"
    
    curl -s -X POST "$API_BASE/download" \
        -H "Content-Type: application/json" \
        -d '{
            "url": "'$SAMPLE_URL'",
            "format": "video+audio",
            "quality": "720p",
            "outputPath": "/tmp/lemolex-downloads",
            "filename": "custom-rick-roll.mp4"
        }' | jq '.' 2>/dev/null || \
    curl -s -X POST "$API_BASE/download" \
        -H "Content-Type: application/json" \
        -d '{
            "url": "'$SAMPLE_URL'",
            "format": "video+audio",
            "quality": "720p",
            "outputPath": "/tmp/lemolex-downloads",
            "filename": "custom-rick-roll.mp4"
        }'
    echo -e "\n"
}

# Example 13: Error Handling - Invalid URL
example_error_invalid_url() {
    print_header "Error Handling - Invalid URL"
    
    echo "POST $API_BASE/info"
    echo "Body: {\"url\":\"https://invalid-url.com\"}"
    
    curl -s -X POST "$API_BASE/info" \
        -H "Content-Type: application/json" \
        -d '{"url":"https://invalid-url.com"}' | jq '.' || \
    curl -s -X POST "$API_BASE/info" \
        -H "Content-Type: application/json" \
        -d '{"url":"https://invalid-url.com"}'
    echo -e "\n"
}

# Example 14: Error Handling - Missing Parameters
example_error_missing_params() {
    print_header "Error Handling - Missing Parameters"
    
    echo "POST $API_BASE/download"
    echo "Body: {} (empty)"
    
    curl -s -X POST "$API_BASE/download" \
        -H "Content-Type: application/json" \
        -d '{}' | jq '.' || \
    curl -s -X POST "$API_BASE/download" \
        -H "Content-Type: application/json" \
        -d '{}'
    echo -e "\n"
}

# Example 15: Monitor Download Progress
example_monitor_progress() {
    print_header "Monitor Download Progress"
    
    # Start a download first
    print_info "Starting a download to monitor..."
    
    RESPONSE=$(curl -s -X POST "$API_BASE/download" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$SAMPLE_URL\",\"format\":\"audio-only\",\"quality\":\"best\"}")
    
    DOWNLOAD_ID=$(echo "$RESPONSE" | jq -r '.data.id' 2>/dev/null)
    
    if [ "$DOWNLOAD_ID" == "null" ] || [ "$DOWNLOAD_ID" == "" ]; then
        print_error "Failed to start download for monitoring"
        return
    fi
    
    print_success "Download started: $DOWNLOAD_ID"
    print_info "Monitoring progress for 30 seconds..."
    
    for i in {1..30}; do
        STATUS_RESPONSE=$(curl -s -X GET "$API_BASE/download/$DOWNLOAD_ID")
        STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.data.status' 2>/dev/null)
        PROGRESS=$(echo "$STATUS_RESPONSE" | jq -r '.data.progress' 2>/dev/null)
        
        if [ "$STATUS" == "completed" ]; then
            print_success "Download completed!"
            break
        elif [ "$STATUS" == "failed" ]; then
            print_error "Download failed!"
            break
        else
            echo "Progress: ${PROGRESS}% - Status: $STATUS"
        fi
        
        sleep 1
    done
    
    echo -e "\n"
}

# Example 16: Test Different Video Formats
example_test_formats() {
    print_header "Test Different Video Formats"
    
    print_info "Testing Video+Audio format..."
    curl -s -X POST "$API_BASE/download" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$SAMPLE_URL\",\"format\":\"video+audio\",\"quality\":\"720p\"}" | jq '.data.id' || echo "Failed"
    
    print_info "Testing Video-Only format..."
    curl -s -X POST "$API_BASE/download" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$SAMPLE_URL\",\"format\":\"video-only\",\"quality\":\"480p\"}" | jq '.data.id' || echo "Failed"
    
    print_info "Testing Audio-Only format..."
    curl -s -X POST "$API_BASE/download" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$SAMPLE_URL\",\"format\":\"audio-only\",\"quality\":\"best\"}" | jq '.data.id' || echo "Failed"
    
    echo -e "\n"
}

# Example 17: Test Multiple URLs
example_test_multiple_urls() {
    print_header "Test Multiple YouTube URLs"
    
    local urls=(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ"  # Rick Roll
        "https://youtu.be/dQw4w9WgXcQ"                 # Short URL
        "https://www.youtube.com/watch?v=L_jWHffIx5E"  # Another video
    )
    
    for url in "${urls[@]}"; do
        print_info "Testing URL: $url"
        
        RESPONSE=$(curl -s -X POST "$API_BASE/info" \
            -H "Content-Type: application/json" \
            -d "{\"url\":\"$url\"}")
        
        TITLE=$(echo "$RESPONSE" | jq -r '.data.title' 2>/dev/null)
        
        if [ "$TITLE" != "null" ] && [ "$TITLE" != "" ]; then
            print_success "✅ Valid: $TITLE"
        else
            print_error "❌ Invalid or failed"
        fi
    done
    
    echo -e "\n"
}

# Example 18: Performance Test
example_performance_test() {
    print_header "Performance Test - Multiple Requests"
    
    print_info "Testing API response times..."
    
    # Test health endpoint
    echo "Testing health endpoint (5 requests):"
    for i in {1..5}; do
        START_TIME=$(date +%s%N)
        curl -s "$API_BASE/health" > /dev/null
        END_TIME=$(date +%s%N)
        DURATION=$(( (END_TIME - START_TIME) / 1000000 ))
        echo "  Request $i: ${DURATION}ms"
    done
    
    # Test info endpoint
    echo "Testing info endpoint (3 requests):"
    for i in {1..3}; do
        START_TIME=$(date +%s%N)
        curl -s -X POST "$API_BASE/info" \
            -H "Content-Type: application/json" \
            -d "{\"url\":\"$SAMPLE_URL\"}" > /dev/null
        END_TIME=$(date +%s%N)
        DURATION=$(( (END_TIME - START_TIME) / 1000000 ))
        echo "  Request $i: ${DURATION}ms"
    done
    
    echo -e "\n"
}

# Interactive menu
show_menu() {
    echo -e "${BLUE}"
    echo "🎬 Lemolex Video Downloader API - cURL Examples"
    echo "=============================================="
    echo -e "${NC}"
    echo "1.  Health Check"
    echo "2.  Get API Documentation"
    echo "3.  Get Video Information"
    echo "4.  Download Video+Audio"
    echo "5.  Download Audio Only"
    echo "6.  Check Download Status"
    echo "7.  Get All Downloads"
    echo "8.  Get Downloads by Status"
    echo "9.  Get Statistics"
    echo "10. Clear Completed Downloads"
    echo "11. Cancel Download"
    echo "12. Custom Download (All Options)"
    echo "13. Error: Invalid URL"
    echo "14. Error: Missing Parameters"
    echo "15. Monitor Download Progress"
    echo "16. Test Different Formats"
    echo "17. Test Multiple URLs"
    echo "18. Performance Test"
    echo "19. Run All Examples"
    echo "0.  Exit"
    echo ""
}

# Run all examples
run_all_examples() {
    print_header "Running All Examples"
    
    example_health_check
    example_get_docs
    example_get_video_info
    example_download_audio_only
    example_check_download_status
    example_get_all_downloads
    example_get_stats
    example_test_formats
    example_test_multiple_urls
    example_error_invalid_url
    example_error_missing_params
    
    print_success "All examples completed!"
}

# Quick test function
quick_test() {
    print_header "Quick API Test"
    
    print_info "1. Testing API health..."
    if curl -s "$API_BASE/health" | grep -q '"status":"healthy"'; then
        print_success "API is healthy"
    else
        print_error "API health check failed"
        return 1
    fi
    
    print_info "2. Testing video info..."
    if curl -s -X POST "$API_BASE/info" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$SAMPLE_URL\"}" | grep -q '"success":true'; then
        print_success "Video info working"
    else
        print_error "Video info failed"
        return 1
    fi
    
    print_info "3. Testing download start..."
    RESPONSE=$(curl -s -X POST "$API_BASE/download" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$SAMPLE_URL\",\"format\":\"audio-only\",\"quality\":\"best\"}")
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        DOWNLOAD_ID=$(echo "$RESPONSE" | jq -r '.data.id' 2>/dev/null)
        print_success "Download started: $DOWNLOAD_ID"
        
        # Quick status check
        sleep 2
        if curl -s "$API_BASE/download/$DOWNLOAD_ID" | grep -q '"success":true'; then
            print_success "Download status check working"
        else
            print_error "Download status check failed"
        fi
    else
        print_error "Download start failed"
        return 1
    fi
    
    print_success "Quick test completed successfully!"
}

# Help function
show_help() {
    echo "Lemolex Video Downloader API - cURL Examples"
    echo ""
    echo "Usage:"
    echo "  ./curl-examples.sh              # Interactive mode"
    echo "  ./curl-examples.sh [option]     # Run specific example"
    echo "  ./curl-examples.sh quick        # Quick test"
    echo "  ./curl-examples.sh help         # Show this help"
    echo ""
    echo "Options:"
    echo "  1|health      - Health check"
    echo "  2|docs        - API documentation"
    echo "  3|info        - Get video info"
    echo "  4|download    - Download video+audio"
    echo "  5|audio       - Download audio only"
    echo "  6|status      - Check download status"
    echo "  7|downloads   - Get all downloads"
    echo "  8|filter      - Get downloads by status"
    echo "  9|stats       - Get statistics"
    echo "  10|clear      - Clear completed downloads"
    echo "  11|cancel     - Cancel download"
    echo "  12|custom     - Custom download options"
    echo "  13|error1     - Test invalid URL error"
    echo "  14|error2     - Test missing params error"
    echo "  15|monitor    - Monitor download progress"
    echo "  16|formats    - Test different formats"
    echo "  17|urls       - Test multiple URLs"
    echo "  18|performance - Performance test"
    echo "  19|all        - Run all examples"
    echo ""
    echo "Examples:"
    echo "  ./curl-examples.sh health       # Just run health check"
    echo "  ./curl-examples.sh audio        # Just test audio download"
    echo "  ./curl-examples.sh quick        # Quick functionality test"
}

# Main script
main() {
    # Check if help requested
    if [ "$1" = "help" ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        show_help
        exit 0
    fi
    
    # Quick test mode
    if [ "$1" = "quick" ]; then
        check_api
        quick_test
        exit $?
    fi
    
    # Check if API is running
    check_api
    
    # Check if jq is available for pretty JSON formatting
    if ! command -v jq &> /dev/null; then
        print_info "jq is not installed. JSON output will not be formatted."
        print_info "Install jq for better output: sudo apt-get install jq (Ubuntu) or brew install jq (macOS)"
        echo ""
    fi
    
    # If arguments provided, run specific example
    if [ $# -gt 0 ]; then
        case $1 in
            1|health) example_health_check ;;
            2|docs) example_get_docs ;;
            3|info) example_get_video_info ;;
            4|download) example_download_video_audio ;;
            5|audio) example_download_audio_only ;;
            6|status) example_check_download_status ;;
            7|downloads) example_get_all_downloads ;;
            8|filter) example_get_downloads_by_status ;;
            9|stats) example_get_stats ;;
            10|clear) example_clear_completed ;;
            11|cancel) example_cancel_download ;;
            12|custom) example_custom_download ;;
            13|error1) example_error_invalid_url ;;
            14|error2) example_error_missing_params ;;
            15|monitor) example_monitor_progress ;;
            16|formats) example_test_formats ;;
            17|urls) example_test_multiple_urls ;;
            18|performance) example_performance_test ;;
            19|all) run_all_examples ;;
            *) 
                print_error "Invalid option: $1"
                echo ""
                show_help
                ;;
        esac
        exit 0
    fi
    
    # Interactive mode
    while true; do
        show_menu
        read -p "Select an option (0-19): " choice
        
        case $choice in
            1) example_health_check ;;
            2) example_get_docs ;;
            3) example_get_video_info ;;
            4) example_download_video_audio ;;
            5) example_download_audio_only ;;
            6) example_check_download_status ;;
            7) example_get_all_downloads ;;
            8) example_get_downloads_by_status ;;
            9) example_get_stats ;;
            10) example_clear_completed ;;
            11) example_cancel_download ;;
            12) example_custom_download ;;
            13) example_error_invalid_url ;;
            14) example_error_missing_params ;;
            15) example_monitor_progress ;;
            16) example_test_formats ;;
            17) example_test_multiple_urls ;;
            18) example_performance_test ;;
            19) run_all_examples ;;
            0) 
                print_success "Goodbye!"
                exit 0
                ;;
            *)
                print_error "Invalid option. Please try again."
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
        clear
    done
}

# Clean up temp files on exit
cleanup() {
    rm -f /tmp/lemolex_download_id.sh
}
trap cleanup EXIT

# Run main function
main "$@"