export type Translations = {
    auth: {
        login: string;
        logout: string;
        loginToSendRequest: string;
        successfullyLoggedIn: string;
        failedToLogin: string;
        failedToLoginWithCredentials: string;
        enterCredentials: string;
        enterUsernameAndPassword: string;
        enterBearerToken: string;
        username: string;
        password: string;
        credentials: string;
        bearerToken: string;
        basicAuth: string;
        bearerTokenGenerated: string;
        bearerTokenNoLongerValid: string;
        oauthClientCredentialsLogin: string;
        oauthToken: string;
        generatedOAuthToken: string;
        userSuppliedBearerToken: string;
        provideTokenManually: string;
        resetTokenToDefault: string;
        enterUsername: string;
        enterPassword: string;
        prefix: string;
        enterValue: string;
    };

    buttons: {
        sendRequest: string;
        send: string;
        sending: string;
        tryIt: string;
        connect: string;
        disconnect: string;
        refresh: string;
        fetch: string;
        fetchBearerToken: string;
        refreshBearerToken: string;
        clear: string;
        clearForm: string;
        change: string;
        copy: string;
        copied: string;
        copyToClipboard: string;
        linkCopied: string;
        copyPage: string;
        downloadFile: string;
        browseFiles: string;
        addMoreFiles: string;
        addNewItem: string;
        addAllOptionalProperties: string;
        useExample: string;
        returnHome: string;
        editThisPage: string;
        clickToRefresh: string;
        viewAsMarkdown: string;
        readLlmsTxt: string;
        connectToCursor: string;
        resetTokenToDefault: string;
        close: string;
        cancel: string;
        moreActions: string;
        moreOptions: string;
        submit: string;
        submitting: string;
        resetToTheDefaultValue: string;
        generate: string;
        retry: string;
        edit: string;
        reportTranslation: string;
    };

    search: {
        search: string;
        searchPlaceholder: string;
        searchForEndpoints: string;
        noResults: string;
        askAI: string;
        askAQuestion: string;
        askQuestionsAboutThisPage: string;
        chatWithAIAssistant: string;
        selectFilters: string;
        changeThemeToLight: string;
        changeThemeToDark: string;
        changeThemeToSystem: string;
        filterTo: string;
        removeFilter: string;
        noResultsFoundFor: string;
        assistant: string;
        askAIAQuestion: string;
        anErrorOccurredResetConvo: string;
        hiIAmAnAIAssistant: string;
        youCanToggleThisPane: string;
        thinking: string;
        footnotes: string;
        addFilter: string;
        closeSearch: string;
        searchOurDocumentation: string;
        filters: string;
        theme: string;
        or: string;
        toGoToRootSearch: string;
        toGoBack: string;
    };

    apiReference: {
        apiReference: string;
        apiExplorer: string;
        openInApiReference: string;
        customizeAndRun: string;
        customizeAndRunIn: string;
        opensApiExplorer: string;
        opensApiExplorerNewTab: string;
        parameters: string;
        pathParameters: string;
        queryParameters: string;
        bodyParameters: string;
        headers: string;
        body: string;
        optionalBody: string;
        payload: string;
        authentication: string;
        authorization: string;
        request: string;
        response: string;
        exampleRequest: string;
        exampleResponse: string;
        errors: string;
        messages: string;
        handshake: string;
        signatures: string;
        contractsAndFunctionSignatures: string;
        endpoints: string;
        url: string;
        method: string;
        status: string;
        notAuthenticated: string;
        authenticated: string;
        time: string;
        size: string;
        failed: string;
        authType: string;
        deprecated: string;
        required: string;
        allowedValues: string;
        any: string;
        orNull: string;
        format: string;
        optional: string;
        statusLower: string;
        timeLower: string;
        selectAVariant: string;
        noMessages: string;
    };

    playground: {
        cannotSendToLocalhost: string;
        sendMessage: string;
        connected: string;
        notConnected: string;
        connecting: string;
        receive: string;
        streamRequest: string;
        streamResponse: string;
        streamedResponse: string;
        stream: string;
        serverSentEvents: string;
        multipartForm: string;
        optional: string;
        required: string;
        nullable: string;
        defaultsTo: string;
        selectAnEndpointToGetStarted: string;
        selectAVariant: string;
        selectAnEnum: string;
        doubleClickToEdit: string;
        selectExample: string;
    };

    responses: {
        responseBodyIsNull: string;
        thisEndpointReturnsFile: string;
        thisEndpointReturnsNothing: string;
        thisEndpointSendsTextResponses: string;
        return200Status: string;
        thisEndpointReturnsAudio: string;
    };

    status: {
        loading: string;
        reloading: string;
        unknownError: string;
        pdfPreview: string;
        switchingProtocols: string;
    };

    feedback: {
        feedback: string;
        wasThisPageHelpful: string;
        wasThisResponseHelpful: string;
        helpUsImproveDocs: string;
        tellUsMoreAboutExperience: string;
        thankYouForFeedback: string;
        whatDidYouLike: string;
        whatWentWrong: string;
        solvedMyIssue: string;
        helpedMeResolveIssue: string;
        helpedMeDecideToUse: string;
        convincedMeToAdopt: string;
        couldntFindWhatLookingFor: string;
        missingImportantInfo: string;
        oneOrMoreCodeSamplesIncorrect: string;
        codeSampleErrors: string;
        tooComplicatedOrUnclear: string;
        doesntAccuratelyDescribe: string;
        anotherReason: string;
        yesOkayToFollowUp: string;
        yes: string;
        no: string;
        reportIncorrectCode: string;
        whatIsWrongWithThisCodeExample: string;
        helpUsImproveByReportingCodeExample: string;
        weHaveBeenNotified: string;
        helpful: string;
        notHelpful: string;
        feedbackReceived: string;
        thankYouForImprovingDocs: string;
        reportTranslationIssue: string;
        whatIsWrongWithTranslation: string;
        helpUsImproveTranslation: string;
        contentWellTranslated: string;
        contentWellTranslatedDescription: string;
        incorrectTranslation: string;
        incorrectTranslationDescription: string;
    };

    feedbackQuality: {
        accurate: string;
        inaccurate: string;
        accuratelyDescribes: string;
        easyToUnderstand: string;
        hardToUnderstand: string;
        easyToFollowAndComprehend: string;
    };

    errors: {
        somethingWentWrong: string;
        pageNotFound: string;
        findingSimilarPages: string;
        errorRenderingForm: string;
        serverConnectionLost: string;
        unexpectedProxyError: string;
        failedToSendRequest: string;
        failedToCopyToClipboard: string;
        errorLoadingPrefix: string;
        errorGeneratingCodeSnippet: string;
        errorCreatingSnippetGenerators: string;
        failedToCreateSnippetGenerators: string;
        errorAccessingMicrophone: string;
        errorEmittingTrackEvent: string;
        failedToInitializePosthog: string;
        errorThrowWhileHighlightingJson: string;
        couldNotCreateContextForEndpoint: string;
        failedToDeregisterListener: string;
        websocketNotAvailable: string;
        notInBrowserEnvironment: string;
        clientFailedToCreateWebsocket: string;
        clientFailedToParseWebsocket: string;
        clientFailedToRevalidate: string;
        clientWebsocketTimeout: string;
        clientWebsocketError: string;
        noEnumValuesFound: string;
        noPortFoundInEnvLocal: string;
        objectExtendsNonObject: string;
        typeDefinitionContextNotFound: string;
        error: string;
        wereYouLookingForOneOfThese: string;
        anErrorOccurred: string;
    };

    navigation: {
        upNext: string;
        olderPosts: string;
        sectionOne: string;
        sectionTwo: string;
        next: string;
        previous: string;
        onThisPage: string;
        lastUpdated: string;
        changelog: string;
    };

    documentation: {
        documentation: string;
        copyPageAsMarkdown: string;
        copyPage: string;
        copyHighlight: string;
        viewThisPageAsPlainText: string;
        installMcpServerOnCursor: string;
        subscribeViaRss: string;
        openInChatGPT: string;
        openInClaude: string;
        developerFriendlyDocs: string;
        builtWith: string;
    };

    environments: {
        prod: string;
        production: string;
        projects: string;
    };

    dataTypes: {
        uuid: string;
        uuids: string;
        base64String: string;
        base64Strings: string;
        dateFormat: string;
        dateTimeFormat: string;
        wallets: string;
    };

    ai: {
        chatGPT: string;
        claude: string;
        audioByElevenLabs: string;
        llm: string;
        endOfSampleSession: string;
    };

    ui: {
        admin: string;
        batch: string;
        myEndpoint: string;
        optionalExtraProperties: string;
        all: string;
    };

    httpMethods: {
        get: string;
        post: string;
        put: string;
        patch: string;
        delete: string;
        head: string;
    };

    authTypes: {
        basic: string;
        bearer: string;
        apiKey: string;
        basicAuth: string;
        bearerAuth: string;
    };

    streamTypes: {
        clientStream: string;
        serverStream: string;
        bidirectionalStream: string;
        batch: string;
        stream: string;
    };

    accessModifiers: {
        readOnly: string;
        writeOnly: string;
    };

    tooltips: {
        copyPageMarkdown: string;
        askQuestion: string;
        viewMarkdown: string;
        openClaude: string;
    };
};
