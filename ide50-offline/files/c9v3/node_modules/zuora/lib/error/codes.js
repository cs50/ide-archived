'use strict';

//CODES taken mostly from http://knowledgecenter.zuora.com/D_Zuora_APIs/REST_API/1_REST_basics/3_Responses_and_errors

module.exports.entries = {
    1: 'UI',
    2: 'SOAP API',
    3: 'Scheduled jobs',
    4: 'Asynchronous jobs',
    5: 'REST API',
    6: 'Forked thread',
    9: 'Unknown'
};

module.exports.objects = {
    '100': 'POSTAccount',
    '101': 'POSTAccountContact',
    '102': 'POSTAccountCreditCard',
    '103': 'POSTAccountCreditCardHolderInfo',
    '104': 'POSTAccountSubscription',
    '150': 'PUTAccount',
    '151': 'PUTAccountContact',
    '160': 'GETAccount',
    '161': 'GETAccountSummary',
    '200': 'POSTPaymentMethod',
    '250': 'PUTPaymentMethod',
    '260': 'GETPaymentMethods',
    '300': 'POSTSubscription',
    '301': 'POSTSrpCreate',
    '302': 'POSTScCreate',
    '310': 'POSTSubscriptionPreview',
    '311': 'POSTSubscriptionPreviewAccount',
    '312': 'POSTSubscriptionPreviewContact',
    '320': 'POSTSubscriptionCancellation',
    '330': 'POSTSubscriptionRenewal',
    '350': 'PUTSubscription',
    '351': 'PUTScAdd',
    '352': 'PUTScUpdate',
    '353': 'PUTSrpAdd',
    '354': 'PUTSrpUpdate',
    '355': 'PUTSrpRemove',
    '360': 'GETSubscriptions',
    '364': 'GETOneSubscription',
    '361': 'GETInvoices',
    '362': 'GETPayments',
    '363': 'GETUsages',
    '400': 'POSTInvoiceCollect',
    '401': 'CommonInvoiceCollectRequest',
    '402': 'CommonInvoiceRequest'
};

module.exports.categories = {
    '00': 'Unknown',
    '10': 'Permission or access denied',
    '11': 'Authentication failed',
    '20': 'Invalid format or value',
    '21': 'Unknown field in request',
    '22': 'Missing required field',
    '30': 'Rule restriction',
    '40': 'Not found',
    '50': 'Locking contention',
    '60': 'Internal error'
};



module.exports.fields = {
    POSTPaymentMethod: {
        '01': 'accountKey',
        '02': 'creditCardType',
        '03': 'creditCardNumber',
        '04': 'expirationMonth',
        '05': 'expirationYear',
        '06': 'securityCode',
        '07': 'defaultPaymentMethod',
        '08': 'cardHolderInfo'
    },
    POSTAccount: {
        '01': 'accountNumber',
        '02': 'name',
        '03': 'currency',
        '04': 'notes',
        '05': 'billCycleDay',
        '06': 'crmId',
        '07': 'invoiceTemplateId',
        '08': 'communicationProfileId',
        '09': 'paymentTerm',
        '10': 'customFieldsData',
        '11': 'billToContact',
        '12': 'soldToContact',
        '13': 'hpmCreditCardPaymentMethodId',
        '14': 'creditCard',
        '15': 'subscription'
    },
    POSTAccountCreditCard: {
        '01': 'creditCard.cardType',
        '02': 'creditCard.cardNumber',
        '03': 'creditCard.expirationMonth',
        '04': 'creditCard.expirationYear',
        '05': 'creditCard.securityCode',
        '06': 'creditCard.cardHolderInfo'
    },
    POSTAccountCreditCardHolderInfo: {
        '01': 'creditCard.cardHolderInfo.cardHolderName',
        '02': 'creditCard.cardHolderInfo.addressLine1',
        '03': 'creditCard.cardHolderInfo.addressLine2',
        '04': 'creditCard.cardHolderInfo.city',
        '05': 'creditCard.cardHolderInfo.state',
        '06': 'creditCard.cardHolderInfo.zipCode',
        '07': 'creditCard.cardHolderInfo.country',
        '08': 'creditCard.cardHolderInfo.phone',
        '09': 'creditCard.cardHolderInfo.email'
    },
    POSTAccountSubscription: {
        '01': 'subscription.termType',
        '02': 'subscription.initialTerm',
        '03': 'subscription.autoRenew',
        '04': 'subscription.renewalTerm',
        '05': 'subscription.notes',
        '06': 'subscription.subscribeToRatePlans',
        '07': 'subscription.contractEffectiveDate'
    },
    POSTAccountContact: {
        '01': 'billToContact.address1',
        '02': 'billToContact.address2',
        '03': 'billToContact.city',
        '04': 'billToContact.country',
        '05': 'billToContact.county',
        '06': 'billToContact.fax',
        '07': 'billToContact.firstName',
        '08': 'billToContact.lastName',
        '09': 'billToContact.homePhone',
        '10': 'billToContact.mobilePhone',
        '11': 'billToContact.nickname',
        '12': 'billToContact.otherPhone',
        '13': 'billToContact.otherPhoneType',
        '14': 'billToContact.personalEmail',
        '15': 'billToContact.zipCode',
        '16': 'billToContact.state',
        '17': 'billToContact.taxRegion',
        '18': 'billToContact.workEmail',
        '19': 'billToContact.workPhone'
    },
    PUTAccount: {
        '01': 'name',
        '02': 'notes',
        '03': 'crmId',
        '04': 'invoiceTemplateId',
        '05': 'communicationProfileId',
        '06': 'customFieldsData',
        '07': 'billToContact',
        '08': 'soldToContact'
    },
    PUTAccountContact: {
        '01': 'billToContact.address1',
        '02': 'billToContact.address2',
        '03': 'billToContact.city',
        '04': 'billToContact.country',
        '05': 'billToContact.county',
        '06': 'billToContact.fax',
        '07': 'billToContact.firstName',
        '08': 'billToContact.homePhone',
        '09': 'billToContact.lastName',
        '10': 'billToContact.mobilePhone',
        '11': 'billToContact.nickname',
        '12': 'billToContact.otherPhone',
        '13': 'billToContact.otherPhoneType',
        '14': 'billToContact.personalEmail',
        '15': 'billToContact.zipCode',
        '16': 'billToContact.state',
        '17': 'billToContact.taxRegion',
        '18': 'billToContact.workEmail',
        '19': 'billToContact.workPhone'
    },
    PUTPaymentMethod: {
        '01': 'expirationMonth',
        '02': 'expirationYear',
        '03': 'defaultPaymentMethod',
        '04': 'cardHolderName',
        '05': 'addressLine1',
        '06': 'addressLine2',
        '07': 'city',
        '08': 'state',
        '09': 'zipCode',
        '10': 'country',
        '11': 'securityCode',
        '12': 'phone',
        '13': 'email'
    },
    POSTSubscription: {
        '01': 'accountKey',
        '02': 'termType',
        '03': 'initialTerm',
        '04': 'autoRenew',
        '05': 'renewalTerm',
        '06': 'notes',
        '07': 'subscribeToRatePlans',
        '08': 'contractEffectiveDate'
    },
    POSTSrpCreate: {
        '01': 'subscription.subscribeToRatePlans.productRatePlanId',
        '02': 'subscription.subscribeToRatePlans.chargeOverrides'
    },
    POSTScCreate: {
        '01': 'subscription.subscribeToRatePlans.chargeOverrides.productRatePlanChargeId',
        '02': 'subscription.subscribeToRatePlans.chargeOverrides.quantity'
    },
    POSTSubscriptionPreview: {
        '01': 'accountKey',
        '02': 'previewAccountInfo',
        '03': 'termType',
        '04': 'initialTerm',
        '05': 'subscribeToRatePlans',
        '06': 'contractEffectiveDate'
    },
    POSTSubscriptionPreviewAccount: {
        '01': 'previewAccountInfo.currency',
        '02': 'previewAccountInfo.billCycleDay',
        '03': 'previewAccountInfo.billToContact'
    },
    POSTSubscriptionPreviewContact: {
        '01': 'previewAccountInfo.billToContact.country',
        '02': 'previewAccountInfo.billToContact.state',
        '03': 'previewAccountInfo.billToContact.city',
        '04': 'previewAccountInfo.billToContact.county',
        '05': 'previewAccountInfo.billToContact.taxRegion',
        '06': 'previewAccountInfo.billToContact.zipCode'
    },
    POSTSubscriptionCancellation: {
        '01': 'cancellationPolicy',
        '02': 'cancellationEffectiveDate'
    },
    PUTSubscription: {
        '01': 'termType',
        '02': 'currentTerm',
        '03': 'renewalTerm',
        '04': 'autoRenew',
        '05': 'notes',
        '06': 'add',
        '07': 'update',
        '08': 'remove',
        '09': 'preview'
    },
    PUTScAdd: {
        '01': 'add.chargeOverrides.productRatePlanChargeId',
        '02': 'add.chargeOverrides.quantity'
    },
    PUTScUpdate: {
        '01': 'update.chargeUpdateDetails.ratePlanChargeId',
        '02': 'update.chargeUpdateDetails.quantity'
    },
    PUTSrpAdd: {
        '01': 'add.productRatePlanId',
        '02': 'add.chargeOverrides',
        '03': 'add.contractEffectiveDate'
    },
    PUTSrpUpdate: {
        '01': 'update.ratePlanId',
        '02': 'update.chargeUpdateDetails',
        '03': 'update.contractEffectiveDate'
    },
    PUTSrpRemove: {
        '01': 'remove.ratePlanId',
        '02': 'remove.contractEffectiveDate'
    },
    CommonInvoiceCollectRequest: {
        '01': 'invoiceCollect'
    },
    CommonInvoiceRequest: {
        '01': 'invoiceTargetDate'
    }
};